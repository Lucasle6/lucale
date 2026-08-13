/**
 * Tests de integración del catálogo.
 *
 * Usan app.inject(): peticiones HTTP simuladas en memoria, sin abrir puertos ni
 * levantar un servidor real. Eso es posible porque buildApp() construye la
 * aplicación sin encenderla.
 *
 * Corren contra la base de datos sembrada con `pnpm db:seed`.
 *
 * Lo que se prueba no es el camino feliz, sino lo que DEBE fallar: que un
 * borrador no se filtre, que un límite absurdo se rechace, que un error no
 * revele nada interno.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("responde ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "bodegon-api" });
  });
});

describe("GET /v1/products", () => {
  it("devuelve productos con el precio ya formateado", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/products?limit=5" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      items: { name: string; priceFromCents: number; priceFromFormatted: string }[];
      nextCursor: string | null;
    }>();

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.length).toBeLessThanOrEqual(5);

    const first = body.items[0];
    expect(first).toBeDefined();
    // El precio viaja en centavos enteros y además ya formateado para mostrar.
    expect(Number.isInteger(first?.priceFromCents)).toBe(true);
    expect(first?.priceFromFormatted).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  it("no expone productos en borrador", async () => {
    // Pedimos el máximo para asegurarnos de recorrer todo el catálogo.
    const response = await app.inject({ method: "GET", url: "/v1/products?limit=50" });
    const body = response.json<{ items: { slug: string }[] }>();

    const slugs = body.items.map((item) => item.slug);
    expect(slugs).not.toContain("salsa-macha-chapulin");
  });

  it("filtra por categoría", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/products?categorySlug=machas",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: { categorySlug: string }[] }>();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.categorySlug).toBe("machas");
    }
  });

  it("busca por nombre sin distinguir mayúsculas", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/products?search=SALSA",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: { name: string }[] }>();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.name.toLowerCase()).toContain("salsa");
    }
  });

  it("pagina por cursor sin repetir productos entre páginas", async () => {
    const first = await app.inject({ method: "GET", url: "/v1/products?limit=3" });
    const firstBody = first.json<{
      items: { id: string }[];
      nextCursor: string | null;
    }>();

    expect(firstBody.items).toHaveLength(3);
    expect(firstBody.nextCursor).not.toBeNull();

    const second = await app.inject({
      method: "GET",
      url: `/v1/products?limit=3&cursor=${firstBody.nextCursor ?? ""}`,
    });
    const secondBody = second.json<{ items: { id: string }[] }>();

    const firstIds = new Set(firstBody.items.map((item) => item.id));
    for (const item of secondBody.items) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });

  it("rechaza un límite por encima del tope", async () => {
    // Sin este tope, `?limit=1000000` tumbaría la base de datos.
    const response = await app.inject({ method: "GET", url: "/v1/products?limit=9999" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});

describe("GET /v1/products/:slug", () => {
  it("devuelve la ficha con sus variantes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/products/salsa-macha-cacahuate",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      name: string;
      variants: { size: string; priceCents: number; sku: string }[];
    }>();

    expect(body.name).toBe("Salsa Macha de Cacahuate");
    // Un producto, tres tamaños, tres precios distintos: el modelo de datos
    // del Día 2 llegando hasta la respuesta HTTP.
    expect(body.variants).toHaveLength(3);
    const precios = body.variants.map((variant) => variant.priceCents);
    expect(new Set(precios).size).toBe(3);
  });

  it("responde 404 sin filtrar detalles internos", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/products/no-existe-este-producto",
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("NOT_FOUND");
    // Nada de stack traces, rutas de archivos ni nombres de tablas.
    expect(JSON.stringify(body)).not.toMatch(/prisma|\.ts:|at Object|SELECT/i);
  });

  it("responde 404 para un producto en borrador", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/products/salsa-macha-chapulin",
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("GET /v1/categories", () => {
  it("devuelve el árbol de categorías", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/categories" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      items: { slug: string; children: { slug: string }[] }[];
    }>();

    const salsas = body.items.find((item) => item.slug === "salsas");
    expect(salsas).toBeDefined();
    expect(salsas?.children.map((child) => child.slug)).toContain("machas");
  });
});

describe("rutas inexistentes", () => {
  it("responden 404 con el mismo formato de error que el resto", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/no-existe" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: { code: "ROUTE_NOT_FOUND" },
    });
  });
});
