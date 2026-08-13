/**
 * CRUD del catálogo desde el panel, probado por HTTP.
 *
 * Cubre las cuatro decisiones del módulo: el admin ve borradores, archivar no
 * borra, el slug no sigue al nombre, y dos admins no se pisan al guardar.
 */

import { UserRole, prisma } from "@bodegon/db";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildApp } from "../../app.js";
import { decryptSecret } from "../../lib/crypto.js";
import { generateTotpCode } from "../../lib/totp.js";

const SUFIJO = "@prueba-catalogo.local";
const CONTRASENA = "mi perro se llama canela";
const PREFIJO_SKU = "TEST-CAT";

let app: FastifyInstance;
let cookiesAdmin: Record<string, string>;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  cookiesAdmin = await crearAdminConSesion();
});

afterAll(async () => {
  await app.close();
  await limpiar();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  await prisma.product.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFIJO } } });
}

function cookiesDe(response: { cookies: unknown[] }): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const cookie of response.cookies as { name: string; value: string }[]) {
    resultado[cookie.name] = cookie.value;
  }
  return resultado;
}

/** Crea un admin con 2FA activo y devuelve sus cookies de sesión del panel. */
async function crearAdminConSesion(): Promise<Record<string, string>> {
  const email = `admin${String(Date.now())}${SUFIJO}`;
  await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: { email, password: CONTRASENA },
  });
  await prisma.user.updateMany({ where: { email }, data: { role: UserRole.ADMIN } });

  const paso1 = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/login",
    payload: { email, password: CONTRASENA },
  });
  const { challengeToken } = paso1.json<{ challengeToken: string }>();

  await app.inject({
    method: "POST",
    url: "/v1/admin/auth/2fa/setup",
    payload: { challengeToken },
  });

  const user = await prisma.user.findFirstOrThrow({ where: { email } });
  const secret = decryptSecret(user.twoFactorSecret ?? "");

  const confirmado = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/2fa/confirm",
    payload: { challengeToken, totpCode: await generateTotpCode(secret) },
  });

  return cookiesDe(confirmado);
}

let contador = 0;
function sku(): string {
  contador += 1;
  return `${PREFIJO_SKU}-${String(Date.now()).slice(-6)}-${String(contador)}`;
}

/** Crea un producto de prueba y devuelve su cuerpo. */
async function crearProducto(overrides: Record<string, unknown> = {}) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/admin/products",
    cookies: cookiesAdmin,
    payload: {
      name: "Prueba Maceta",
      slug: `prueba-maceta-${String(Date.now())}-${String(contador)}`,
      // Obligatoria desde que el catálogo mezcla alimentos (0%) con utensilios
      // (16%). Los casos que prueban la tasa en sí la sobrescriben.
      taxRateBps: 1600,
      variants: [{ size: "Pequeña", sku: sku(), priceCents: 14990, stock: 5 }],
      ...overrides,
    },
  });
  return response;
}

describe("crear productos", () => {
  it("crea un producto con sus variantes en estado borrador", async () => {
    const response = await crearProducto();

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      status: string;
      variants: { priceCents: number; priceFormatted: string }[];
      totalStock: number;
    }>();

    // Nace en DRAFT: se puede armar con calma sin que aparezca a medias.
    expect(body.status).toBe("DRAFT");
    expect(body.variants).toHaveLength(1);
    expect(body.variants[0]?.priceCents).toBe(14990);
    expect(body.variants[0]?.priceFormatted).toBe("$149.90");
    // El panel SÍ ve el inventario exacto, a diferencia del catálogo público.
    expect(body.totalStock).toBe(5);
  });

  it("genera el slug a partir del nombre, quitando acentos", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/products",
      cookies: cookiesAdmin,
      payload: {
        name: `Prueba Lámpara Otoño ${String(Date.now())}`,
        taxRateBps: 1600,
        variants: [{ size: "Única", sku: sku(), priceCents: 1000, stock: 1 }],
      },
    });

    expect(response.statusCode).toBe(201);
    // "á" y "ñ" se traducen; sin eso saldría "l-mpara".
    expect(response.json<{ slug: string }>().slug).toMatch(/^prueba-lampara-otono-\d+$/);
  });

  it("rechaza un SKU que ya existe", async () => {
    const repetido = sku();
    await crearProducto({
      variants: [{ size: "A", sku: repetido, priceCents: 100, stock: 1 }],
    });

    const segunda = await crearProducto({
      variants: [{ size: "B", sku: repetido, priceCents: 200, stock: 1 }],
    });

    expect(segunda.statusCode).toBe(409);
  });

  it("exige al menos una variante", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/products",
      cookies: cookiesAdmin,
      payload: { name: "Sin variantes", variants: [] },
    });

    // Un producto sin variantes no tiene precio, y sin precio no se vende.
    expect(response.statusCode).toBe(400);
  });

  it("rechaza precios negativos o absurdos", async () => {
    const negativo = await crearProducto({
      variants: [{ size: "A", sku: sku(), priceCents: -100, stock: 1 }],
    });
    expect(negativo.statusCode).toBe(400);

    const absurdo = await crearProducto({
      variants: [{ size: "A", sku: sku(), priceCents: 999_999_999, stock: 1 }],
    });
    expect(absurdo.statusCode).toBe(400);
  });
});

describe("listar y ver productos", () => {
  it("el panel SÍ ve los borradores, a diferencia de la tienda", async () => {
    const creado = await crearProducto();
    const { slug } = creado.json<{ slug: string }>();

    const panel = await app.inject({
      method: "GET",
      url: "/v1/admin/products?status=DRAFT&limit=100",
      cookies: cookiesAdmin,
    });
    const slugsPanel = panel
      .json<{ items: { slug: string }[] }>()
      .items.map((p) => p.slug);
    expect(slugsPanel).toContain(slug);

    // La tienda pública no lo ve.
    const tienda = await app.inject({ method: "GET", url: `/v1/products/${slug}` });
    expect(tienda.statusCode).toBe(404);
  });

  it("busca por SKU, que es como el admin identifica sus piezas", async () => {
    const skuBuscado = sku();
    await crearProducto({
      variants: [{ size: "A", sku: skuBuscado, priceCents: 500, stock: 2 }],
    });

    const response = await app.inject({
      method: "GET",
      url: `/v1/admin/products?search=${skuBuscado}`,
      cookies: cookiesAdmin,
    });

    expect(response.json<{ items: unknown[] }>().items).toHaveLength(1);
  });
});

describe("actualizar productos", () => {
  it("cambia el nombre SIN cambiar el slug", async () => {
    const creado = await crearProducto();
    const { id, slug, updatedAt } = creado.json<{
      id: string;
      slug: string;
      updatedAt: string;
    }>();

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/admin/products/${id}`,
      cookies: cookiesAdmin,
      payload: { name: "Nombre Corregido", expectedUpdatedAt: updatedAt },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ name: string; slug: string }>();
    expect(body.name).toBe("Nombre Corregido");
    // Si el slug siguiera al nombre, corregir una falta rompería todos los
    // enlaces compartidos y el posicionamiento.
    expect(body.slug).toBe(slug);
  });

  it("bloquea la escritura si otro admin guardó primero", async () => {
    const creado = await crearProducto();
    const { id, updatedAt } = creado.json<{ id: string; updatedAt: string }>();

    // Admin A guarda.
    const primera = await app.inject({
      method: "PATCH",
      url: `/v1/admin/products/${id}`,
      cookies: cookiesAdmin,
      payload: { name: "Cambio de A", expectedUpdatedAt: updatedAt },
    });
    expect(primera.statusCode).toBe(200);

    // Admin B tenía el formulario abierto desde antes y guarda con la marca
    // de tiempo vieja.
    const segunda = await app.inject({
      method: "PATCH",
      url: `/v1/admin/products/${id}`,
      cookies: cookiesAdmin,
      payload: { name: "Cambio de B", expectedUpdatedAt: updatedAt },
    });

    // Sin esto, B pisaría a A y ninguno se enteraría.
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json<{ error: { message: string } }>().error.message).toMatch(
      /editó este producto/i,
    );
  });

  it("publica un borrador y entonces sí aparece en la tienda", async () => {
    const creado = await crearProducto();
    const { id, slug, updatedAt } = creado.json<{
      id: string;
      slug: string;
      updatedAt: string;
    }>();

    await app.inject({
      method: "PATCH",
      url: `/v1/admin/products/${id}`,
      cookies: cookiesAdmin,
      payload: { status: "ACTIVE", expectedUpdatedAt: updatedAt },
    });

    const tienda = await app.inject({ method: "GET", url: `/v1/products/${slug}` });
    expect(tienda.statusCode).toBe(200);
  });
});

describe("archivar productos", () => {
  it("archiva en vez de borrar", async () => {
    const creado = await crearProducto({ status: "ACTIVE" });
    const { id, slug } = creado.json<{ id: string; slug: string }>();

    const response = await app.inject({
      method: "DELETE",
      url: `/v1/admin/products/${id}`,
      cookies: cookiesAdmin,
    });
    expect(response.statusCode).toBe(200);

    // La fila SIGUE existiendo: aparece en facturas y pedidos antiguos.
    const enBase = await prisma.product.findUnique({ where: { id } });
    expect(enBase).not.toBeNull();
    expect(enBase?.status).toBe("ARCHIVED");

    // Pero desaparece de la tienda.
    const tienda = await app.inject({ method: "GET", url: `/v1/products/${slug}` });
    expect(tienda.statusCode).toBe(404);
  });
});

describe("auditoría", () => {
  it("registra quién creó y quién archivó cada producto", async () => {
    const creado = await crearProducto();
    const { id } = creado.json<{ id: string }>();

    await app.inject({
      method: "DELETE",
      url: `/v1/admin/products/${id}`,
      cookies: cookiesAdmin,
    });

    const registros = await prisma.auditLog.findMany({
      where: { entityType: "Product", entityId: id },
      orderBy: { createdAt: "asc" },
    });

    const acciones = registros.map((r) => r.action);
    expect(acciones).toContain("product.created");
    expect(acciones).toContain("product.archived");
    // Un producto con precio $1 debe poder rastrearse hasta quién lo puso así.
    expect(registros[0]?.actorId).not.toBeNull();
  });
});

describe("subida de imágenes", () => {
  /** Arma un cuerpo multipart a mano, sin depender de una librería. */
  function multipart(
    campo: string,
    nombreArchivo: string,
    contentType: string,
    contenido: Buffer,
  ): { payload: Buffer; headers: Record<string, string> } {
    const frontera = "----prueba-frontera-1234";
    const cabecera = Buffer.from(
      `--${frontera}\r\n` +
        `Content-Disposition: form-data; name="${campo}"; filename="${nombreArchivo}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    );
    const cierre = Buffer.from(`\r\n--${frontera}--\r\n`);
    return {
      payload: Buffer.concat([cabecera, contenido, cierre]),
      headers: { "content-type": `multipart/form-data; boundary=${frontera}` },
    };
  }

  it("acepta una imagen real y la guarda como WebP", async () => {
    const creado = await crearProducto();
    const { id } = creado.json<{ id: string }>();

    const png = await sharp({
      create: { width: 80, height: 60, channels: 3, background: "#c9a227" },
    })
      .png()
      .toBuffer();

    const { payload, headers } = multipart("file", "producto.png", "image/png", png);
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/products/${id}/images`,
      cookies: cookiesAdmin,
      headers,
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{ url: string; width: number; height: number }>();
    expect(body.url).toMatch(/\.webp$/);
    expect(body.width).toBe(80);
    expect(body.height).toBe(60);
  });

  it("RECHAZA un script disfrazado de .png", async () => {
    const creado = await crearProducto();
    const { id } = creado.json<{ id: string }>();

    // El nombre dice .png y el Content-Type dice image/png: las dos cosas las
    // elige quien sube. El contenido dice otra cosa.
    const script = Buffer.from('<?php system($_GET["cmd"]); ?>');
    const { payload, headers } = multipart("file", "foto.png", "image/png", script);

    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/products/${id}/images`,
      cookies: cookiesAdmin,
      headers,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { message: string } }>().error.message).toMatch(
      /no es una imagen/i,
    );

    // Y no se creó ninguna fila de imagen.
    const imagenes = await prisma.productImage.count({ where: { productId: id } });
    expect(imagenes).toBe(0);
  });

  it("exige sesión de admin", async () => {
    const creado = await crearProducto();
    const { id } = creado.json<{ id: string }>();

    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#000" },
    })
      .png()
      .toBuffer();
    const { payload, headers } = multipart("file", "a.png", "image/png", png);

    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/products/${id}/images`,
      headers,
      payload,
    });

    expect(response.statusCode).toBe(401);
  });
});
