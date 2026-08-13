/**
 * Webhook de Stripe: la única fuente de verdad sobre el pago.
 *
 * El recorrido de un evento, en orden:
 *
 *   1. Se verifica la FIRMA        → ¿de verdad es Stripe quien llama?
 *   2. Se registra el evento       → ¿ya lo habíamos procesado?
 *   3. Se aplica al pedido         → estado + inventario, en una transacción
 *   4. Se marca como procesado
 *
 * Los pasos 1 y 2 no son opcionales ni cosméticos. Sin el 1, cualquiera con la
 * URL puede declarar pagado un pedido y llevarse la mercancía. Sin el 2, un
 * reintento de Stripe —que ocurre a menudo— descuenta el inventario dos veces.
 */

import type { Prisma } from "@bodegon/db";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { stripe } from "../../lib/stripe.js";
import type { Stripe } from "../../lib/stripe.js";
import * as repo from "./webhook.repository.js";

/** Lo que el endpoint responde a Stripe. Se le contesta rápido y corto. */
export interface ResultadoWebhook {
  received: true;
  /** Solo para nuestros logs y tests; a Stripe le da igual. */
  resultado: "procesado" | "duplicado" | "ignorado";
}

/**
 * Tipos de evento que nos interesan.
 *
 * Stripe manda decenas de tipos. Escuchar solo lo que sabemos manejar evita
 * procesar por accidente algo cuyo significado no hemos pensado.
 */
const EVENTOS_MANEJADOS = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
]);

/**
 * Verifica la firma y devuelve el evento ya tipado.
 *
 * `constructEvent` hace dos comprobaciones, y la segunda se olvida a menudo:
 *
 *   - Que el HMAC-SHA256 del cuerpo con el secreto coincida con la cabecera.
 *   - Que la marca de tiempo de la firma sea RECIENTE (5 minutos por defecto).
 *
 * La segunda es lo que impide un ataque de repetición: sin ella, alguien que
 * capturara un evento legítimo de "pago completado" podría reenviarlo mañana,
 * con su firma auténtica, y volvería a colar.
 *
 * Recibe el cuerpo CRUDO. Si le pasas el objeto ya parseado y reserializado,
 * los bytes no son los mismos y la firma nunca cuadra.
 */
function verificarFirma(rawBody: Buffer, signature: string): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (causa) {
    // 400 y no 401: para Stripe significa "no me lo reenvíes, está mal
    // formado". Un 5xx le diría que fue culpa nuestra y reintentaría en vano.
    throw new AppError(
      400,
      "INVALID_SIGNATURE",
      "La firma del webhook no es válida",
      causa instanceof Error ? causa.message : undefined,
    );
  }
}

export async function handleStripeEvent(
  rawBody: Buffer,
  signature: string,
  log: FastifyBaseLogger,
): Promise<ResultadoWebhook> {
  // ── 1. ¿Es Stripe? ─────────────────────────────────────────────────────────
  const evento = verificarFirma(rawBody, signature);

  if (!EVENTOS_MANEJADOS.has(evento.type)) {
    // Se responde 200 igualmente: el evento llegó bien, simplemente no nos
    // toca hacer nada. Un error haría que Stripe reintentara sin sentido.
    return { received: true, resultado: "ignorado" };
  }

  // ── 2. ¿Ya lo habíamos visto? ──────────────────────────────────────────────
  const registro = await repo.registrarEvento({
    externalId: evento.id,
    type: evento.type,
    payload: evento as unknown as Prisma.InputJsonValue,
  });

  if (registro.estado === "ya-procesado") {
    log.info({ eventoStripe: evento.id }, "Evento duplicado, ya estaba procesado");
    return { received: true, resultado: "duplicado" };
  }

  // ── 3. Aplicarlo ───────────────────────────────────────────────────────────
  try {
    // Se comprueban los dos tipos explícitamente, en vez de un `else`, porque
    // `Stripe.Event` es una unión discriminada: solo comparando contra el tipo
    // concreto sabe TypeScript qué forma tiene `data.object`. Con un `else`, ahí
    // dentro cabrían los otros setenta y tantos objetos de Stripe.
    if (evento.type === "checkout.session.completed") {
      await confirmarPago(evento.data.object, log);
    } else if (evento.type === "checkout.session.expired") {
      await cancelarCaducada(evento.data.object, log);
    }
  } catch (causa) {
    const mensaje = causa instanceof Error ? causa.message : String(causa);
    await repo.marcarFallido(registro.id, mensaje);
    log.error({ eventoStripe: evento.id, err: causa }, "El webhook falló al aplicarse");
    // Se relanza para responder 500: así Stripe lo reintenta, y como el evento
    // quedó sin `processedAt`, el reintento vuelve a entrar aquí.
    throw causa;
  }

  await repo.marcarProcesado(registro.id);
  return { received: true, resultado: "procesado" };
}

// ─── Pago confirmado ─────────────────────────────────────────────────────────

async function confirmarPago(
  sesion: Stripe.Checkout.Session,
  log: FastifyBaseLogger,
): Promise<void> {
  const orderId = sesion.metadata?.orderId;

  if (typeof orderId !== "string") {
    // Sin metadatos no hay forma fiable de saber a qué pedido corresponde.
    // Es un fallo nuestro al crear la sesión, no de Stripe.
    throw new Error(`La sesión ${sesion.id} llegó sin orderId en los metadatos`);
  }

  const orden = await repo.buscarOrden(orderId);
  if (orden === null) {
    throw new Error(`La sesión ${sesion.id} apunta al pedido ${orderId}, que no existe`);
  }

  /**
   * El importe se vuelve a comprobar AQUÍ, aunque ya se comprobó al crear la
   * sesión. No es redundancia inútil: son dos momentos distintos y lo que se
   * verifica es distinto. Allí, que pedimos bien; aquí, que se cobró lo que
   * pedimos. Entre los dos instantes pasó una pasarela de pago entera.
   */
  if (sesion.amount_total !== orden.totalCents) {
    throw new Error(
      `El pedido ${orden.orderNumber} vale ${String(orden.totalCents)} pero Stripe cobró ${String(sesion.amount_total)}`,
    );
  }

  const paymentIntentId =
    typeof sesion.payment_intent === "string"
      ? sesion.payment_intent
      : (sesion.payment_intent?.id ?? null);

  const cartId = sesion.metadata?.cartId ?? null;
  const { aplicado, faltantes } = await repo.confirmarPago(
    orden,
    paymentIntentId,
    cartId,
  );

  if (!aplicado) {
    // El pedido ya no estaba PENDING. Puede ser un duplicado que se coló por
    // otra vía, o un pedido cancelado. No es un error: es la máquina de
    // estados haciendo su trabajo.
    log.info(
      { pedido: orden.orderNumber, estado: orden.status },
      "El pedido ya no estaba pendiente; no se aplicó el pago",
    );
    return;
  }

  /**
   * Inventario insuficiente con el dinero ya cobrado.
   *
   * Es el caso incómodo: alguien compró la última unidad mientras este cliente
   * tecleaba su tarjeta. El pago YA ocurrió, así que negarlo en nuestra base no
   * lo deshace — el pedido se queda como PAID porque eso es lo que pasó.
   *
   * Lo que hacemos es dejarlo gritando en los logs para que una persona lo
   * resuelva: reponer, avisar al cliente o reembolsar. Un sistema honesto
   * distingue "esto está mal" de "esto no ocurrió".
   */
  if (faltantes.length > 0) {
    log.error(
      { pedido: orden.orderNumber, faltantes },
      "PEDIDO PAGADO SIN INVENTARIO SUFICIENTE: requiere intervención manual",
    );
  }

  log.info({ pedido: orden.orderNumber }, "Pago confirmado y stock descontado");
}

// ─── Sesión caducada ─────────────────────────────────────────────────────────

async function cancelarCaducada(
  sesion: Stripe.Checkout.Session,
  log: FastifyBaseLogger,
): Promise<void> {
  const orderId = sesion.metadata?.orderId;
  if (typeof orderId !== "string") return;

  const cancelado = await repo.cancelarPorCaducidad(orderId);

  if (cancelado) {
    // Sin esto, los pedidos abandonados se acumularían como PENDING para
    // siempre y ensuciarían cualquier métrica de conversión.
    log.info({ orderId }, "Sesión de pago caducada; pedido cancelado");
  }
}
