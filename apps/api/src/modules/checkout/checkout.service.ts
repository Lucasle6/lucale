/**
 * Reglas de negocio del checkout.
 *
 * El orden de los pasos no es casual, y es lo que conviene entender de este
 * archivo:
 *
 *   1. Se revalida el carrito              → nada de fiarse de la pantalla
 *   2. Se releen los precios del catálogo  → la lectura que acaba en la factura
 *   3. Se CONGELA el pedido en PENDING     → registro contable, ya inmutable
 *   4. Se pide la sesión a Stripe          → con esos importes, no otros
 *
 * El pedido se crea ANTES de mandar a nadie a pagar. Puede parecer al revés
 * —¿para qué guardar algo que quizá no se pague?— pero es la única forma de
 * tener a qué asociar el cobro cuando Stripe nos avise. Si lo creáramos
 * después, un cliente que paga y cierra la pestaña habría pagado por un pedido
 * que no existe en ninguna parte.
 */

import type { Prisma } from "@bodegon/db";
import { ProductStatus } from "@bodegon/db";
import { calculateTotals, taxIncludedIn } from "@bodegon/shared";
import type { CheckoutInput, CheckoutSession, ShippingAddress } from "@bodegon/shared";
import { env } from "../../config/env.js";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors.js";
import { stripe } from "../../lib/stripe.js";
import type { Stripe } from "../../lib/stripe.js";
import type { CartOwner } from "../cart/cart.service.js";
import { assertPurchasable } from "../cart/cart.service.js";
import * as repo from "./checkout.repository.js";

/**
 * Cuánto vive la pantalla de pago.
 *
 * Una hora es tiempo de sobra para teclear una tarjeta, y acota cuántos pedidos
 * PENDING pueden acumularse. Stripe exige un mínimo de 30 minutos.
 */
const MINUTOS_VALIDEZ_SESION = 60;

/**
 * Convierte la dirección validada en el JSON que se guarda en el pedido.
 *
 * Los opcionales se normalizan a `null` en vez de dejarlos ausentes: JSON no
 * tiene `undefined`, y una columna donde a veces falta la clave y a veces vale
 * null es un dolor de cabeza para cualquiera que la consulte después.
 *
 * `country` se escribe aquí y no se pide al cliente: hoy solo enviamos a México.
 * Queda en el registro para que el día que eso cambie, los pedidos viejos sigan
 * diciendo a qué país fueron.
 */
function direccionAJson(direccion: ShippingAddress): Prisma.InputJsonObject {
  return {
    recipientName: direccion.recipientName,
    street: direccion.street,
    exteriorNumber: direccion.exteriorNumber,
    interiorNumber: direccion.interiorNumber ?? null,
    neighborhood: direccion.neighborhood,
    city: direccion.city,
    state: direccion.state,
    postalCode: direccion.postalCode,
    phone: direccion.phone,
    references: direccion.references ?? null,
    country: "MX",
  };
}

export async function createCheckoutSession(
  owner: CartOwner,
  input: CheckoutInput,
): Promise<CheckoutSession> {
  // ── 1. El carrito, revalidado ──────────────────────────────────────────────
  // Comprueba que no esté vacío y que ninguna línea se pase del inventario.
  const carrito = await assertPurchasable(owner);

  // ── 2. Los precios, releídos del catálogo ──────────────────────────────────
  // Esta es la lectura que manda. El carrito ya traía precios, pero los leyó
  // para pintar una pantalla que el cliente pudo tener abierta media hora.
  const variantes = await repo.findVariantsForOrder(
    carrito.lines.map((linea) => linea.variantId),
  );
  const porId = new Map(variantes.map((variante) => [variante.id, variante]));

  const lineas = carrito.lines.map((linea) => {
    const variante = porId.get(linea.variantId);

    // Que falte aquí significa que se borró entre la pantalla y este instante.
    if (
      variante === undefined ||
      variante.deletedAt !== null ||
      variante.product.deletedAt !== null ||
      variante.product.status !== ProductStatus.ACTIVE
    ) {
      throw new NotFoundError(
        `"${linea.productName}" dejó de estar disponible. Quítalo del carrito para continuar.`,
      );
    }

    if (linea.quantity > variante.stock) {
      throw new ConflictError(
        variante.stock === 0
          ? `"${linea.productName}" (${variante.size}) se agotó mientras comprabas.`
          : `De "${linea.productName}" (${variante.size}) solo quedan ${String(variante.stock)}.`,
      );
    }

    const lineTotalCents = variante.priceCents * linea.quantity;
    const taxRateBps = variante.product.taxRateBps;

    return {
      variantId: variante.id,
      productNameSnapshot: variante.product.name,
      sizeSnapshot: variante.size,
      skuSnapshot: variante.sku,
      unitPriceCents: variante.priceCents,
      quantity: linea.quantity,
      lineTotalCents,
      // La tasa y el impuesto se congelan aquí, junto al precio: los tres
      // describen la venta de hoy, no el catálogo de mañana.
      taxRateBpsSnapshot: taxRateBps,
      taxCents: taxIncludedIn(lineTotalCents, taxRateBps),
      taxRateBps,
    };
  });

  const subtotalCents = lineas.reduce((suma, linea) => suma + linea.lineTotalCents, 0);

  /**
   * ⚠️ PUNTO 1 — El cliente paga lo que vio.
   *
   * Si el subtotal recalculado no coincide con el que el carrito acaba de
   * mostrar, es que un precio cambió entre las dos lecturas. Preferimos parar
   * a cobrar en silencio un importe distinto del que había en pantalla: el
   * cliente vuelve al carrito, ve el precio nuevo y decide.
   *
   * Cobrar de más sin avisar es un problema legal; cobrar de menos, un agujero
   * que alguien acabaría explotando.
   */
  if (subtotalCents !== carrito.subtotalCents) {
    throw new ConflictError(
      "Los precios cambiaron mientras comprabas. Revisa tu carrito antes de pagar.",
    );
  }

  // Se pasan las líneas, no el subtotal: con tasas mixtas el impuesto se
  // calcula línea por línea. Ver el comentario de `calculateTotals`.
  const totales = calculateTotals(lineas);

  // ── 3. El pedido, congelado ────────────────────────────────────────────────
  const orden = await repo.createPendingOrder({
    userId: owner.tipo === "usuario" ? owner.userId : null,
    email: input.email,
    subtotalCents: totales.subtotalCents,
    shippingCents: totales.shippingCents,
    taxCents: totales.taxCents,
    totalCents: totales.totalCents,
    shippingAddress: direccionAJson(input.shippingAddress),
    lines: lineas,
  });

  // ── 4. La sesión de pago ───────────────────────────────────────────────────
  let sesion: Stripe.Checkout.Session;

  try {
    sesion = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        locale: "es",

        // Solo tarjeta por ahora. OXXO existe en Stripe México y es medio
        // mercado, pero se paga en efectivo hasta 3 días después: obliga a un
        // estado "esperando pago" que el Día 12 aún no modela. Se añade cuando
        // la máquina de estados sepa esperar.
        payment_method_types: ["card"],

        // Las líneas se construyen desde los SNAPSHOTS, no desde el carrito:
        // lo que Stripe cobra y lo que dice la factura salen del mismo sitio.
        line_items: lineas.map((linea) => ({
          quantity: linea.quantity,
          price_data: {
            currency: "mxn",
            unit_amount: linea.unitPriceCents,
            product_data: {
              name: linea.productNameSnapshot,
              description: `Presentación ${linea.sizeSnapshot}`,
              metadata: { sku: linea.skuSnapshot },
            },
          },
        })),

        // El envío va como concepto propio y no sumado a las líneas, para que
        // el cliente vea en la pantalla de Stripe el mismo desglose que vio en
        // el carrito.
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name:
                totales.shippingCents === 0 ? "Envío gratis" : "Envío nacional",
              fixed_amount: { amount: totales.shippingCents, currency: "mxn" },
            },
          },
        ],

        customer_email: input.email,

        /**
         * ⚠️ PUNTO 2 — El hilo que une el cobro con el pedido.
         *
         * Cuando Stripe nos avise del pago (Día 12), el evento traerá estos
         * metadatos. Sin ellos tendríamos un cobro correcto y ninguna forma
         * fiable de saber a qué pedido corresponde.
         *
         * Se repiten en `payment_intent_data` porque los reembolsos y las
         * disputas llegan asociados al PaymentIntent, no a la sesión.
         */
        client_reference_id: orden.id,
        metadata: { orderId: orden.id, orderNumber: orden.orderNumber },
        payment_intent_data: {
          metadata: { orderId: orden.id, orderNumber: orden.orderNumber },
        },

        expires_at: Math.floor(Date.now() / 1000) + MINUTOS_VALIDEZ_SESION * 60,

        success_url: `${env.WEB_ORIGIN}/checkout/exito?pedido=${encodeURIComponent(orden.orderNumber)}`,
        cancel_url: `${env.WEB_ORIGIN}/checkout/cancelado`,
      },
      {
        /**
         * Clave de idempotencia: el id del pedido.
         *
         * Si la red falla y el SDK reintenta, Stripe reconoce que es la misma
         * operación y devuelve la sesión que ya creó en vez de crear una
         * segunda. Un pedido, una sesión de pago, pase lo que pase con la red.
         */
        idempotencyKey: `checkout_session_${orden.id}`,
      },
    );
  } catch (causa) {
    // El pedido ya existe pero nunca tendrá pantalla de pago. Se cancela para
    // que no quede un PENDING fantasma en el panel.
    await repo.markCancelled(orden.id);
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_ERROR",
      "No pudimos abrir la pantalla de pago. Inténtalo de nuevo en un momento.",
      causa instanceof Error ? causa.message : undefined,
    );
  }

  /**
   * ⚠️ PUNTO 3 — Que Stripe cobre exactamente lo que dice el pedido.
   *
   * Stripe suma las líneas y el envío por su cuenta. Si su total no coincide
   * con el nuestro, hay un error de aritmética en alguna parte, y el momento
   * de descubrirlo es ahora — no cuando un cliente reclame que se le cobró de
   * más. Es una afirmación barata que convierte un bug silencioso en un fallo
   * ruidoso.
   */
  if (sesion.amount_total !== orden.totalCents) {
    await repo.markCancelled(orden.id);
    throw new AppError(
      500,
      "AMOUNT_MISMATCH",
      "No pudimos confirmar el importe del pago. No se te ha cobrado nada.",
      {
        esperado: orden.totalCents,
        recibidoDeStripe: sesion.amount_total,
      },
    );
  }

  if (sesion.url === null) {
    await repo.markCancelled(orden.id);
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_ERROR",
      "No pudimos abrir la pantalla de pago. Inténtalo de nuevo en un momento.",
    );
  }

  await repo.attachStripeSession(orden.id, sesion.id);

  /**
   * El carrito NO se vacía aquí.
   *
   * Se vacía cuando el pago se confirma (Día 12). Si lo borráramos ahora, quien
   * llegue a la pantalla de Stripe y decida volver atrás encontraría su carrito
   * vacío — habríamos castigado a alguien por dudar.
   */
  return {
    orderId: orden.id,
    orderNumber: orden.orderNumber,
    checkoutUrl: sesion.url,
  };
}
