/**
 * Checkout, probado por HTTP.
 *
 * STRIPE ESTÁ SIMULADO. Un test nunca debe llamar a un servicio externo: sería
 * lento, dependería de la red, gastaría cuota ajena y fallaría por motivos que
 * no tienen nada que ver con nuestro código.
 *
 * Pero el simulacro no devuelve un importe fijo: RECALCULA el total a partir de
 * las líneas que le mandamos, igual que haría Stripe de verdad. Así el test
 * comprueba de verdad la invariante que nos importa — que lo que pedimos cobrar
 * coincide con lo que dice el pedido — en vez de dar por buena una respuesta
 * que escribimos nosotros.
 */

import { prisma } from "@bodegon/db";
import type { Cart, CheckoutSession } from "@bodegon/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `vi.hoisted` es necesario porque `vi.mock` se eleva por encima de los
 * imports: sin esto, la variable aún no existiría cuando se evalúa la fábrica.
 */
const { crearSesionStripe } = vi.hoisted(() => ({ crearSesionStripe: vi.fn() }));

vi.mock("../../lib/stripe.js", () => ({
  stripe: { checkout: { sessions: { create: crearSesionStripe } } },
}));

const { buildApp } = await import("../../app.js");

const SUFIJO = "@prueba-checkout.local";
const PREFIJO_SLUG = "prueba-checkout-";
const inicioDeLaEjecucion = new Date();

let app: FastifyInstance;
let salsaId: string; // alimento, tasa 0%
let cucharaId: string; // utensilio, 16%

/** Parámetros con los que Stripe recibiría la sesión. */
interface ParamsStripe {
  line_items: {
    quantity: number;
    price_data: { unit_amount: number; currency: string };
  }[];
  shipping_options: {
    shipping_rate_data: { fixed_amount: { amount: number } };
  }[];
  metadata: { orderId: string; orderNumber: string };
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const marca = String(Date.now());

  const salsa = await prisma.product.create({
    data: {
      name: "Prueba Salsa Macha",
      slug: `${PREFIJO_SLUG}salsa-${marca}`,
      status: "ACTIVE",
      taxRateBps: 0,
      variants: {
        create: [
          { size: "250 ml", sku: `PRB-SAL-${marca}`, priceCents: 18_000, stock: 10 },
        ],
      },
    },
    include: { variants: true },
  });

  const cuchara = await prisma.product.create({
    data: {
      name: "Prueba Cuchara de Encino",
      slug: `${PREFIJO_SLUG}cuchara-${marca}`,
      status: "ACTIVE",
      taxRateBps: 1600,
      variants: {
        create: [{ size: "30 cm", sku: `PRB-CUC-${marca}`, priceCents: 9_500, stock: 3 }],
      },
    },
    include: { variants: true },
  });

  salsaId = salsa.variants[0]!.id;
  cucharaId = cuchara.variants[0]!.id;
});

afterAll(async () => {
  await app.close();
  // El orden importa: los pedidos y carritos apuntan a las variantes, y borrar
  // el producto primero arrastraría las líneas del carrito por cascada.
  await prisma.order.deleteMany({ where: { email: { endsWith: SUFIJO } } });
  await prisma.cart.deleteMany({ where: { createdAt: { gte: inicioDeLaEjecucion } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIJO_SLUG } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  crearSesionStripe.mockReset();

  // Comportamiento por defecto: se comporta como Stripe y SUMA POR SU CUENTA.
  crearSesionStripe.mockImplementation((params: ParamsStripe) => {
    const lineas = params.line_items.reduce(
      (suma, li) => suma + li.price_data.unit_amount * li.quantity,
      0,
    );
    const envio = params.shipping_options[0]!.shipping_rate_data.fixed_amount.amount;

    return Promise.resolve({
      id: `cs_test_simulada_${Math.random().toString(36).slice(2)}`,
      url: "https://checkout.stripe.com/c/pay/cs_test_simulada",
      amount_total: lineas + envio,
    });
  });
});

// ─── Utilidades ──────────────────────────────────────────────────────────────

function cookiesDe(response: { cookies: unknown[] }): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const cookie of response.cookies as { name: string; value: string }[]) {
    resultado[cookie.name] = cookie.value;
  }
  return resultado;
}

/** Crea un carrito de invitado con las líneas indicadas. */
async function carritoCon(
  piezas: { variantId: string; quantity: number }[],
): Promise<{ cookies: Record<string, string>; cart: Cart }> {
  let cookies: Record<string, string> = {};
  let cart: Cart = {
    lines: [],
    itemCount: 0,
    subtotalCents: 0,
    subtotalFormatted: "",
    hasIssues: false,
  };

  for (const pieza of piezas) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      cookies,
      payload: pieza,
    });
    cookies = { ...cookies, ...cookiesDe(response) };
    cart = response.json<Cart>();
  }

  return { cookies, cart };
}

const direccion = {
  recipientName: "José Luis Castañeda",
  street: "Avenida Reforma",
  exteriorNumber: "222",
  neighborhood: "Juárez",
  city: "Cuauhtémoc",
  state: "Ciudad de México",
  postalCode: "06600",
  phone: "55 1234 5678",
};

function pagar(cookies: Record<string, string>, extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/v1/checkout/session",
    cookies,
    payload: {
      email: `cliente${String(Date.now())}${SUFIJO}`,
      shippingAddress: direccion,
      ...extra,
    },
  });
}

// ─── El pedido se congela bien ───────────────────────────────────────────────

describe("crear la sesión de pago", () => {
  it("congela el pedido en PENDING y devuelve la URL de Stripe", async () => {
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 2 }]);
    const response = await pagar(cookies);

    expect(response.statusCode).toBe(200);
    const body = response.json<CheckoutSession>();
    expect(body.checkoutUrl).toContain("checkout.stripe.com");
    expect(body.orderNumber).toMatch(/^LCL-\d{4}-\d+$/);

    const orden = await prisma.order.findUniqueOrThrow({
      where: { id: body.orderId },
      include: { items: true },
    });

    // NUNCA pagado aquí: eso solo ocurre con el webhook firmado (Día 12).
    expect(orden.status).toBe("PENDING");
    expect(orden.paidAt).toBeNull();
    expect(orden.stripeSessionId).toMatch(/^cs_test_/);

    expect(orden.subtotalCents).toBe(36_000);
    expect(orden.shippingCents).toBe(9_900);
    expect(orden.totalCents).toBe(45_900);
  });

  it("copia nombre, talla, SKU y precio en la línea del pedido", async () => {
    const { cookies } = await carritoCon([{ variantId: cucharaId, quantity: 1 }]);
    const body = (await pagar(cookies)).json<CheckoutSession>();

    const items = await prisma.orderItem.findMany({ where: { orderId: body.orderId } });
    const linea = items[0]!;

    // Si mañana se borra la variante del catálogo, esta fila sigue sabiendo qué
    // se vendió: por eso son copias y no una relación.
    expect(linea.productNameSnapshot).toBe("Prueba Cuchara de Encino");
    expect(linea.sizeSnapshot).toBe("30 cm");
    expect(linea.skuSnapshot).toMatch(/^PRB-CUC-/);
    expect(linea.unitPriceCents).toBe(9_500);
    expect(linea.lineTotalCents).toBe(9_500);
  });

  it("permite comprar sin cuenta, guardando el correo", async () => {
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 1 }]);
    const body = (await pagar(cookies)).json<CheckoutSession>();

    const orden = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } });

    expect(orden.userId).toBeNull();
    expect(orden.email).toContain(SUFIJO);
  });

  it("no vacía el carrito: quien duda no debe perder lo que eligió", async () => {
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 1 }]);
    await pagar(cookies);

    const despues = await app.inject({ method: "GET", url: "/v1/cart", cookies });
    expect(despues.json<Cart>().itemCount).toBe(1);
  });
});

// ─── Impuestos ───────────────────────────────────────────────────────────────

describe("IVA con tasas mixtas", () => {
  it("congela la tasa de cada línea y suma el impuesto por separado", async () => {
    const { cookies } = await carritoCon([
      { variantId: salsaId, quantity: 2 }, // $360.00 al 0%
      { variantId: cucharaId, quantity: 1 }, // $95.00 al 16%
    ]);
    const body = (await pagar(cookies)).json<CheckoutSession>();

    const orden = await prisma.order.findUniqueOrThrow({
      where: { id: body.orderId },
      include: { items: true },
    });

    const salsa = orden.items.find((i) => i.taxRateBpsSnapshot === 0);
    const cuchara = orden.items.find((i) => i.taxRateBpsSnapshot === 1600);

    expect(salsa?.taxCents).toBe(0);
    expect(cuchara?.taxCents).toBe(1_310);

    // 0 + 1310 (cuchara) + 1366 (IVA del envío) = 2676
    expect(orden.taxCents).toBe(2_676);

    // Aplicar el 16% al total daría 7641: casi tres veces más.
    expect(orden.taxCents).not.toBe(7_641);
  });

  it("el impuesto no forma parte del total cobrado", async () => {
    const { cookies } = await carritoCon([{ variantId: cucharaId, quantity: 1 }]);
    const body = (await pagar(cookies)).json<CheckoutSession>();

    const orden = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } });

    expect(orden.totalCents).toBe(orden.subtotalCents + orden.shippingCents);
  });
});

// ─── Seguridad ───────────────────────────────────────────────────────────────

describe("el importe nunca viene del cliente", () => {
  it("ignora los importes que se cuelen en el cuerpo", async () => {
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 2 }]);

    // Lo que haría alguien con las herramientas del navegador abiertas.
    const response = await pagar(cookies, {
      totalCents: 1,
      subtotalCents: 1,
      shippingCents: 0,
      taxCents: 0,
    });

    expect(response.statusCode).toBe(200);
    const orden = await prisma.order.findUniqueOrThrow({
      where: { id: response.json<CheckoutSession>().orderId },
    });

    // El total sale de la base de datos, no del cuerpo de la petición.
    expect(orden.totalCents).toBe(45_900);
  });

  it("le pide a Stripe exactamente el importe del pedido", async () => {
    const { cookies } = await carritoCon([{ variantId: cucharaId, quantity: 2 }]);
    const body = (await pagar(cookies)).json<CheckoutSession>();

    const orden = await prisma.order.findUniqueOrThrow({ where: { id: body.orderId } });
    const [params] = crearSesionStripe.mock.calls[0] as [ParamsStripe];

    const pedidoAStripe =
      params.line_items.reduce(
        (s, li) => s + li.price_data.unit_amount * li.quantity,
        0,
      ) + params.shipping_options[0]!.shipping_rate_data.fixed_amount.amount;

    expect(pedidoAStripe).toBe(orden.totalCents);
    expect(params.line_items[0]?.price_data.currency).toBe("mxn");
  });

  it("cancela el pedido si Stripe cobrara un importe distinto", async () => {
    // Se fuerza el desajuste: un bug de aritmética, o una manipulación.
    crearSesionStripe.mockResolvedValueOnce({
      id: "cs_test_desajustada",
      url: "https://checkout.stripe.com/c/pay/desajustada",
      amount_total: 1, // un centavo
    });

    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 1 }]);
    const response = await pagar(cookies);

    expect(response.statusCode).toBe(500);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "AMOUNT_MISMATCH",
    );

    // Y no queda un pedido PENDING fantasma esperando un pago que no llegará.
    const huerfano = await prisma.order.findFirst({
      where: { stripeSessionId: "cs_test_desajustada" },
    });
    expect(huerfano).toBeNull();

    const cancelados = await prisma.order.count({
      where: { email: { endsWith: SUFIJO }, status: "CANCELLED" },
    });
    expect(cancelados).toBeGreaterThan(0);
  });

  it("usa el id del pedido como clave de idempotencia", async () => {
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 1 }]);
    const body = (await pagar(cookies)).json<CheckoutSession>();

    const [, opciones] = crearSesionStripe.mock.calls[0] as [
      ParamsStripe,
      { idempotencyKey: string },
    ];

    // Si la red falla y el SDK reintenta, Stripe reconoce la operación y
    // devuelve la sesión que ya creó en vez de abrir una segunda.
    expect(opciones.idempotencyKey).toBe(`checkout_session_${body.orderId}`);
  });

  it("manda el id del pedido en los metadatos, para poder casar el pago", async () => {
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 1 }]);
    const body = (await pagar(cookies)).json<CheckoutSession>();

    const [params] = crearSesionStripe.mock.calls[0] as [ParamsStripe];

    // Sin esto, el webhook del Día 12 tendría un cobro correcto y ninguna
    // forma fiable de saber a qué pedido corresponde.
    expect(params.metadata.orderId).toBe(body.orderId);
    expect(params.metadata.orderNumber).toBe(body.orderNumber);
  });
});

// ─── Rechazos ────────────────────────────────────────────────────────────────

describe("cuándo se rechaza el pago", () => {
  it("no deja pagar un carrito vacío", async () => {
    const response = await pagar({});

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toContain(
      "vacío",
    );
    expect(crearSesionStripe).not.toHaveBeenCalled();
  });

  it("rechaza si se pide más de lo que hay en inventario", async () => {
    // La cuchara tiene 3 en stock.
    const { cookies } = await carritoCon([{ variantId: cucharaId, quantity: 3 }]);

    await prisma.productVariant.update({
      where: { id: cucharaId },
      data: { stock: 1 },
    });

    const response = await pagar(cookies);

    expect(response.statusCode).toBe(409);
    expect(crearSesionStripe).not.toHaveBeenCalled();

    await prisma.productVariant.update({
      where: { id: cucharaId },
      data: { stock: 3 },
    });
  });

  it("acepta un correo con espacios y mayúsculas", async () => {
    // REGRESIÓN: el esquema validaba antes de limpiar, así que un correo
    // copiado y pegado con un espacio se rechazaba por formato inválido.
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 1 }]);

    const response = await pagar(cookies, {
      email: `  Cliente.Prueba${String(Date.now())}${SUFIJO.toUpperCase()}  `,
    });

    expect(response.statusCode).toBe(200);

    const orden = await prisma.order.findUniqueOrThrow({
      where: { id: response.json<CheckoutSession>().orderId },
    });
    expect(orden.email).toBe(orden.email.trim().toLowerCase());
  });

  it("rechaza una dirección incompleta antes de tocar Stripe", async () => {
    const { cookies } = await carritoCon([{ variantId: salsaId, quantity: 1 }]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/checkout/session",
      cookies,
      payload: {
        email: `cliente${String(Date.now())}${SUFIJO}`,
        shippingAddress: { ...direccion, neighborhood: "" },
      },
    });

    expect(response.statusCode).toBe(400);
    // Nada de crear pedidos ni sesiones por una dirección que no sirve.
    expect(crearSesionStripe).not.toHaveBeenCalled();
  });
});
