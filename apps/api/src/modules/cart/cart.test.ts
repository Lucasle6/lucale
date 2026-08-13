/**
 * Carrito, probado por HTTP.
 *
 * El caso central es el control de seguridad nº 18: intentar manipular el
 * precio desde el cliente y comprobar que el total no cambia.
 */

import { prisma } from "@bodegon/db";
import type { Cart } from "@bodegon/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

let app: FastifyInstance;
/** Variante real del catálogo sembrado, para no inventar datos. */
let variante: { id: string; priceCents: number; stock: number };

/**
 * Instante en que arrancó este archivo de pruebas. Delimita qué carritos son
 * nuestros y cuáles no: ver la explicación en `afterAll`.
 */
const inicioDeLaEjecucion = new Date();

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  variante = await prisma.productVariant.findFirstOrThrow({
    where: { sku: "SAL-MAC-CAC-250" },
    select: { id: true, priceCents: true, stock: true },
  });
});

afterAll(async () => {
  await app.close();

  /**
   * Se borran SOLO los carritos que creó esta ejecución.
   *
   * Antes decía `{ sessionToken: { not: null } }`, que no significa "los míos"
   * sino "TODOS los carritos de invitado que existan en la base". Como los
   * tests corren contra la misma base que el desarrollo, cada `pnpm test`
   * borraba el carrito que tuvieras abierto en el navegador. Costó un rato
   * entenderlo: la tienda decía "tu carrito está vacío" justo después de
   * añadir algo, y la culpa no estaba en el carrito sino aquí.
   *
   * El resto de archivos ya lo hacían bien, acotando por sufijo de correo o
   * prefijo de slug. Este era la excepción.
   *
   * Se acota por fecha porque el token lo genera el servidor y la prueba no
   * puede marcarlo al crearlo.
   *
   * La solución de fondo es una base de datos aparte para los tests, y va en
   * el Día 14 con la integración continua: mientras compartan base, cualquier
   * limpieza mal acotada puede pisar datos de desarrollo.
   */
  await prisma.cart.deleteMany({
    where: { createdAt: { gte: inicioDeLaEjecucion } },
  });

  await prisma.$disconnect();
});

function cookiesDe(response: { cookies: unknown[] }): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const cookie of response.cookies as { name: string; value: string }[]) {
    resultado[cookie.name] = cookie.value;
  }
  return resultado;
}

/** Crea un carrito de invitado con una línea y devuelve sus cookies. */
async function carritoConUnaPieza(cantidad = 1): Promise<{
  cookies: Record<string, string>;
  cart: Cart;
}> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/cart/items",
    payload: { variantId: variante.id, quantity: cantidad },
  });
  return { cookies: cookiesDe(response), cart: response.json<Cart>() };
}

describe("el precio nunca viene del cliente", () => {
  it("ignora un precio enviado en el cuerpo", async () => {
    // Esto es lo que haría alguien con las herramientas del navegador
    // abiertas: añadir campos al cuerpo esperando que el servidor los use.
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      payload: {
        variantId: variante.id,
        quantity: 1,
        priceCents: 1,
        unitPriceCents: 1,
        price: 0.01,
        lineTotalCents: 1,
        subtotalCents: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    const cart = response.json<Cart>();

    // El total sale de la base de datos, no del cuerpo de la petición.
    expect(cart.subtotalCents).toBe(variante.priceCents);
    expect(cart.lines[0]?.unitPriceCents).toBe(variante.priceCents);
  });

  it("calcula el total multiplicando precio de la base por cantidad", async () => {
    const { cart } = await carritoConUnaPieza(3);

    expect(cart.lines[0]?.quantity).toBe(3);
    expect(cart.subtotalCents).toBe(variante.priceCents * 3);
    // Y en centavos enteros: ninguna operación con decimales por el camino.
    expect(Number.isInteger(cart.subtotalCents)).toBe(true);
  });

  it("recalcula el total si el precio cambia en el catálogo", async () => {
    const { cookies } = await carritoConUnaPieza(2);

    const nuevoPrecio = variante.priceCents + 5000;
    await prisma.productVariant.update({
      where: { id: variante.id },
      data: { priceCents: nuevoPrecio },
    });

    try {
      const response = await app.inject({ method: "GET", url: "/v1/cart", cookies });
      const cart = response.json<Cart>();

      // El carrito refleja el precio ACTUAL, no el que se vio al añadirlo.
      // Congelar el precio es tarea de la orden, no del carrito.
      expect(cart.subtotalCents).toBe(nuevoPrecio * 2);
    } finally {
      await prisma.productVariant.update({
        where: { id: variante.id },
        data: { priceCents: variante.priceCents },
      });
    }
  });
});

describe("operaciones del carrito", () => {
  it("empieza vacío", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/cart" });

    expect(response.statusCode).toBe(200);
    const cart = response.json<Cart>();
    expect(cart.lines).toHaveLength(0);
    expect(cart.subtotalCents).toBe(0);
    expect(cart.subtotalFormatted).toBe("$0.00");
  });

  it("suma cantidades en vez de duplicar la línea", async () => {
    const { cookies } = await carritoConUnaPieza(1);

    const segunda = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      cookies,
      payload: { variantId: variante.id, quantity: 2 },
    });

    const cart = segunda.json<Cart>();
    // La restricción única (cartId, variantId) del Día 2 lo garantiza.
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(3);
  });

  it("cambia la cantidad de una línea", async () => {
    const { cookies, cart } = await carritoConUnaPieza(1);
    const itemId = cart.lines[0]?.id ?? "";

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/cart/items/${itemId}`,
      cookies,
      payload: { quantity: 4 },
    });

    expect(response.json<Cart>().lines[0]?.quantity).toBe(4);
  });

  it("cantidad 0 elimina la línea", async () => {
    const { cookies, cart } = await carritoConUnaPieza(2);
    const itemId = cart.lines[0]?.id ?? "";

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/cart/items/${itemId}`,
      cookies,
      payload: { quantity: 0 },
    });

    expect(response.json<Cart>().lines).toHaveLength(0);
  });

  it("vacía el carrito entero", async () => {
    const { cookies } = await carritoConUnaPieza(2);

    const response = await app.inject({ method: "DELETE", url: "/v1/cart", cookies });
    expect(response.json<Cart>().lines).toHaveLength(0);
  });
});

describe("límites y stock", () => {
  it("rechaza más unidades de las que hay", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      payload: { variantId: variante.id, quantity: variante.stock + 1 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: { message: string } }>().error.message).toMatch(
      /quedan|agotado/i,
    );
  });

  it("cuenta el total acumulado, no solo lo que se añade", async () => {
    const { cookies } = await carritoConUnaPieza(variante.stock - 1);

    // Ya hay stock-1; pedir 2 más superaría el inventario aunque 2 sea poco.
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      cookies,
      payload: { variantId: variante.id, quantity: 2 },
    });

    expect(response.statusCode).toBe(409);
  });

  it("avisa si el stock bajó DESPUÉS de añadir", async () => {
    const { cookies } = await carritoConUnaPieza(5);

    await prisma.productVariant.update({
      where: { id: variante.id },
      data: { stock: 2 },
    });

    try {
      const response = await app.inject({ method: "GET", url: "/v1/cart", cookies });
      const cart = response.json<Cart>();

      // Se avisa aquí en vez de fallar al pagar: mejor enterarse antes.
      expect(cart.hasIssues).toBe(true);
      expect(cart.lines[0]?.exceedsStock).toBe(true);
      expect(cart.lines[0]?.availableStock).toBe(2);
    } finally {
      await prisma.productVariant.update({
        where: { id: variante.id },
        data: { stock: variante.stock },
      });
    }
  });

  it("rechaza cantidades absurdas", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      payload: { variantId: variante.id, quantity: 9999 },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("aislamiento entre carritos", () => {
  it("cada invitado tiene el suyo", async () => {
    const primero = await carritoConUnaPieza(2);
    const segundo = await app.inject({ method: "GET", url: "/v1/cart" });

    // Sin cookie del primero, el segundo ve un carrito vacío.
    expect(segundo.json<Cart>().lines).toHaveLength(0);
    expect(primero.cart.lines).toHaveLength(1);
  });

  it("no se puede tocar la línea de otro carrito", async () => {
    const ajeno = await carritoConUnaPieza(1);
    const itemAjeno = ajeno.cart.lines[0]?.id ?? "";

    // Otro invitado, con su propia cookie, intenta modificar esa línea.
    const propio = await carritoConUnaPieza(1);

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/cart/items/${itemAjeno}`,
      cookies: propio.cookies,
      payload: { quantity: 10 },
    });

    // Comprobación de propiedad (control nº 16, anti-IDOR): sin ella,
    // cualquiera modificaría el carrito de otro pasando su id.
    expect(response.statusCode).toBe(404);
  });
});

describe("productos no disponibles", () => {
  it("no se puede añadir un producto en borrador", async () => {
    const borrador = await prisma.productVariant.findFirstOrThrow({
      where: { product: { status: "DRAFT" } },
      select: { id: true },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      payload: { variantId: borrador.id, quantity: 1 },
    });

    // Mismo 404 que si no existiera: el catálogo público no debe servir para
    // averiguar qué borradores hay.
    expect(response.statusCode).toBe(404);
  });

  it("rechaza una variante inventada", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      payload: {
        variantId: "00000000-0000-7000-8000-000000000000",
        quantity: 1,
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
