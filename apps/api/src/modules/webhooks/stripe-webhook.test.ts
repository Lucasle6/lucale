/**
 * Webhook de Stripe, probado por HTTP.
 *
 * Aquí NO se simula Stripe: se usa su verificador de firmas de verdad, y los
 * eventos se firman con el mismo algoritmo que usa él. Un simulacro que
 * devolviera "firma válida" no probaría lo único que importa de este endpoint.
 *
 * La prueba central es la del reenvío: Stripe entrega el mismo evento varias
 * veces ante cualquier duda, y sin idempotencia eso descontaría el inventario
 * tantas veces como reintentos haya.
 */

import { OrderStatus, prisma } from "@bodegon/db";
import Stripe from "stripe";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";

const SUFIJO = "@prueba-webhook.local";
const PREFIJO_SLUG = "prueba-webhook-";
const inicioDeLaEjecucion = new Date();

let app: FastifyInstance;
let variantId: string;

const stripeParaFirmar = new Stripe(env.STRIPE_SECRET_KEY);

const STOCK_INICIAL = 10;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const marca = String(Date.now());
  const producto = await prisma.product.create({
    data: {
      name: "Prueba Salsa Webhook",
      slug: `${PREFIJO_SLUG}salsa-${marca}`,
      status: "ACTIVE",
      taxRateBps: 0,
      variants: {
        create: [
          {
            size: "250 ml",
            sku: `PRB-WHK-${marca}`,
            priceCents: 18_000,
            stock: STOCK_INICIAL,
          },
        ],
      },
    },
    include: { variants: true },
  });
  variantId = producto.variants[0]!.id;
});

afterAll(async () => {
  await app.close();
  await prisma.webhookEvent.deleteMany({
    where: { createdAt: { gte: inicioDeLaEjecucion } },
  });
  await prisma.order.deleteMany({ where: { email: { endsWith: SUFIJO } } });
  await prisma.cart.deleteMany({ where: { createdAt: { gte: inicioDeLaEjecucion } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIJO_SLUG } } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Cada prueba parte del mismo inventario, para poder afirmar sobre él.
  await prisma.productVariant.update({
    where: { id: variantId },
    data: { stock: STOCK_INICIAL },
  });
});

// ─── Utilidades ──────────────────────────────────────────────────────────────

let contador = 0;

/** Crea un pedido PENDING con una línea, como lo dejaría el checkout. */
async function pedidoPendiente(cantidad = 2) {
  contador += 1;
  const total = 18_000 * cantidad + 9_900;

  return prisma.order.create({
    data: {
      orderNumber: `LCL-TEST-${String(Date.now())}-${String(contador)}`,
      email: `cliente${String(Date.now())}${String(contador)}${SUFIJO}`,
      status: OrderStatus.PENDING,
      subtotalCents: 18_000 * cantidad,
      shippingCents: 9_900,
      taxCents: 1_366,
      totalCents: total,
      shippingAddress: { city: "Cuauhtémoc", country: "MX" },
      items: {
        create: [
          {
            variantId,
            productNameSnapshot: "Prueba Salsa Webhook",
            sizeSnapshot: "250 ml",
            skuSnapshot: "PRB-WHK",
            unitPriceCents: 18_000,
            quantity: cantidad,
            lineTotalCents: 18_000 * cantidad,
            taxRateBpsSnapshot: 0,
            taxCents: 0,
          },
        ],
      },
    },
    select: { id: true, orderNumber: true, totalCents: true },
  });
}

/** Construye el cuerpo de un evento tal como lo mandaría Stripe. */
function cuerpoDeEvento(opciones: {
  eventId: string;
  type: string;
  orderId: string;
  amountTotal: number;
}): string {
  return JSON.stringify({
    id: opciones.eventId,
    object: "event",
    type: opciones.type,
    data: {
      object: {
        id: `cs_test_${opciones.eventId}`,
        object: "checkout.session",
        amount_total: opciones.amountTotal,
        payment_intent: `pi_test_${opciones.eventId}`,
        metadata: { orderId: opciones.orderId, orderNumber: "LCL-TEST" },
      },
    },
  });
}

/**
 * Entrega el evento al endpoint, firmado igual que lo firmaría Stripe.
 *
 * `generateTestHeaderString` es del propio SDK y produce una cabecera real, con
 * su marca de tiempo y su HMAC. No estamos esquivando la verificación: la
 * estamos alimentando con entradas legítimas.
 */
function entregar(cuerpo: string, opciones: { firma?: string; timestamp?: number } = {}) {
  const firma =
    opciones.firma ??
    stripeParaFirmar.webhooks.generateTestHeaderString({
      payload: cuerpo,
      secret: env.STRIPE_WEBHOOK_SECRET,
      ...(opciones.timestamp === undefined ? {} : { timestamp: opciones.timestamp }),
    });

  return app.inject({
    method: "POST",
    url: "/v1/webhooks/stripe",
    headers: { "content-type": "application/json", "stripe-signature": firma },
    payload: cuerpo,
  });
}

// ─── Firma ───────────────────────────────────────────────────────────────────

describe("verificación de firma", () => {
  it("rechaza un evento sin cabecera de firma", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/stripe",
      headers: { "content-type": "application/json" },
      payload: "{}",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "MISSING_SIGNATURE",
    );
  });

  it("rechaza una firma inventada", async () => {
    const orden = await pedidoPendiente();
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_falso_${String(Date.now())}`,
      type: "checkout.session.completed",
      orderId: orden.id,
      amountTotal: orden.totalCents,
    });

    const response = await entregar(cuerpo, { firma: "t=123,v1=firmainventada" });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "INVALID_SIGNATURE",
    );

    // Y lo importante: el pedido NO se tocó.
    const despues = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
    expect(despues.status).toBe(OrderStatus.PENDING);
  });

  it("rechaza un evento legítimo pero viejo, para impedir la repetición", async () => {
    const orden = await pedidoPendiente();
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_viejo_${String(Date.now())}`,
      type: "checkout.session.completed",
      orderId: orden.id,
      amountTotal: orden.totalCents,
    });

    // Firma auténtica, pero de hace una hora. Es el escenario de alguien que
    // captura un evento real de "pago completado" y lo reenvía después.
    const haceUnaHora = Math.floor(Date.now() / 1000) - 3_600;
    const response = await entregar(cuerpo, { timestamp: haceUnaHora });

    expect(response.statusCode).toBe(400);
    const despues = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
    expect(despues.status).toBe(OrderStatus.PENDING);
  });
});

// ─── Confirmación del pago ───────────────────────────────────────────────────

describe("pago confirmado", () => {
  it("pasa el pedido a PAID y descuenta el inventario", async () => {
    const orden = await pedidoPendiente(2);
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_ok_${String(Date.now())}`,
      type: "checkout.session.completed",
      orderId: orden.id,
      amountTotal: orden.totalCents,
    });

    const response = await entregar(cuerpo);

    expect(response.statusCode).toBe(200);
    expect(response.json<{ resultado: string }>().resultado).toBe("procesado");

    const despues = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
    expect(despues.status).toBe(OrderStatus.PAID);
    expect(despues.paidAt).not.toBeNull();
    expect(despues.stripePaymentIntentId).toMatch(/^pi_test_/);

    const variante = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variante.stock).toBe(STOCK_INICIAL - 2);
  });

  it("rechaza el evento si el importe cobrado no coincide con el pedido", async () => {
    const orden = await pedidoPendiente();
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_desajuste_${String(Date.now())}`,
      type: "checkout.session.completed",
      orderId: orden.id,
      amountTotal: 1, // un centavo
    });

    const response = await entregar(cuerpo);

    expect(response.statusCode).toBe(500);

    // El pedido sigue pendiente y el inventario intacto: ante un importe que no
    // cuadra, no se entrega nada.
    const despues = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
    expect(despues.status).toBe(OrderStatus.PENDING);

    const variante = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variante.stock).toBe(STOCK_INICIAL);
  });

  it("responde 200 e ignora los tipos de evento que no manejamos", async () => {
    const orden = await pedidoPendiente();
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_otro_${String(Date.now())}`,
      type: "customer.subscription.created",
      orderId: orden.id,
      amountTotal: orden.totalCents,
    });

    const response = await entregar(cuerpo);

    // 200 y no error: el evento llegó bien, simplemente no nos toca actuar.
    // Un error haría que Stripe lo reintentara durante días sin sentido.
    expect(response.statusCode).toBe(200);
    expect(response.json<{ resultado: string }>().resultado).toBe("ignorado");
  });
});

// ─── Idempotencia ────────────────────────────────────────────────────────────

describe("el mismo evento entregado varias veces", () => {
  it("descuenta el inventario UNA sola vez aunque llegue tres", async () => {
    const orden = await pedidoPendiente(3);
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_repetido_${String(Date.now())}`,
      type: "checkout.session.completed",
      orderId: orden.id,
      amountTotal: orden.totalCents,
    });

    const primera = await entregar(cuerpo);
    const segunda = await entregar(cuerpo);
    const tercera = await entregar(cuerpo);

    // Las tres se responden con éxito: a Stripe se le dice "recibido" siempre,
    // porque un error le haría reintentar todavía más.
    expect(primera.statusCode).toBe(200);
    expect(segunda.statusCode).toBe(200);
    expect(tercera.statusCode).toBe(200);

    expect(primera.json<{ resultado: string }>().resultado).toBe("procesado");
    expect(segunda.json<{ resultado: string }>().resultado).toBe("duplicado");
    expect(tercera.json<{ resultado: string }>().resultado).toBe("duplicado");

    // Y el efecto ocurrió una vez.
    const variante = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variante.stock).toBe(STOCK_INICIAL - 3);

    const despues = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
    expect(despues.status).toBe(OrderStatus.PAID);
  });

  it("aguanta tres entregas SIMULTÁNEAS del mismo evento", async () => {
    const orden = await pedidoPendiente(2);
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_carrera_${String(Date.now())}`,
      type: "checkout.session.completed",
      orderId: orden.id,
      amountTotal: orden.totalCents,
    });

    // Sin esperar entre ellas: es el caso que una comprobación
    // "leer y luego decidir" no cubriría, porque las tres leerían lo mismo.
    const respuestas = await Promise.all([
      entregar(cuerpo),
      entregar(cuerpo),
      entregar(cuerpo),
    ]);

    const procesadas = respuestas.filter(
      (r) =>
        r.statusCode === 200 && r.json<{ resultado: string }>().resultado === "procesado",
    );
    expect(procesadas).toHaveLength(1);

    const variante = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variante.stock).toBe(STOCK_INICIAL - 2);
  });
});

// ─── Caducidad ───────────────────────────────────────────────────────────────

describe("sesión de pago caducada", () => {
  it("cancela el pedido para que no quede PENDING eterno", async () => {
    const orden = await pedidoPendiente();
    const cuerpo = cuerpoDeEvento({
      eventId: `evt_caducada_${String(Date.now())}`,
      type: "checkout.session.expired",
      orderId: orden.id,
      amountTotal: orden.totalCents,
    });

    const response = await entregar(cuerpo);
    expect(response.statusCode).toBe(200);

    const despues = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
    expect(despues.status).toBe(OrderStatus.CANCELLED);
    expect(despues.cancelledAt).not.toBeNull();

    // Y sin tocar el inventario: nunca se descontó, no hay nada que devolver.
    const variante = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variante.stock).toBe(STOCK_INICIAL);
  });
});
