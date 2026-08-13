/**
 * Protección CSRF, probada con la guarda ENCENDIDA.
 *
 * En el resto de la suite el CSRF va desactivado, igual que el rate limiting:
 * las pruebas hacen mutaciones con `inject()` y exigirles un token las rompería
 * todas por un motivo ajeno a lo que comprueban. Aquí se enciende a propósito,
 * porque un control que nunca se ejecuta en los tests es un control que nadie
 * ha verificado.
 */

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { CSRF_COOKIE, CSRF_HEADER } from "./csrf.js";

let app: FastifyInstance;

beforeAll(async () => {
  // La llave que enciende la guarda solo para este archivo.
  app = await buildApp({ csrf: true });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

/** Hace un GET y devuelve el token que el servidor entregó en la cookie. */
async function obtenerToken(): Promise<{ token: string; cookie: string }> {
  const response = await app.inject({ method: "GET", url: "/v1/products?limit=1" });

  const cookies = response.cookies as { name: string; value: string }[];
  const csrf = cookies.find((c) => c.name === CSRF_COOKIE);

  if (csrf === undefined) throw new Error("El servidor no entregó cookie CSRF");
  return { token: csrf.value, cookie: csrf.value };
}

describe("entrega del token", () => {
  it("da un token en las peticiones de lectura", async () => {
    const { token } = await obtenerToken();
    expect(token.length).toBeGreaterThan(20);
  });

  it("la cookie es legible por JavaScript, a propósito", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/products?limit=1" });
    const cabecera = response.headers["set-cookie"];
    const texto = Array.isArray(cabecera) ? cabecera.join(";") : String(cabecera);

    // Es la única cookie del sistema sin HttpOnly. El frontend TIENE que poder
    // leerla para repetirla en la cabecera; su seguridad viene de que solo
    // nuestro origen puede leerla, no de que sea secreta.
    const lineaCsrf = texto.split(",").find((c) => c.includes(CSRF_COOKIE)) ?? "";
    expect(lineaCsrf).not.toContain("HttpOnly");
  });
});

describe("mutaciones", () => {
  it("rechaza una mutación sin token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      payload: { variantId: "019ffb44-731f-70b0-877d-e2a82f7971a6", quantity: 1 },
    });

    expect(response.statusCode).toBe(403);
  });

  it("rechaza una mutación con cookie pero SIN cabecera", async () => {
    const { cookie } = await obtenerToken();

    // Este es exactamente el escenario del ataque: el navegador de la víctima
    // manda la cookie sola, porque el sitio atacante no puede leerla para
    // copiarla en la cabecera.
    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      cookies: { [CSRF_COOKIE]: cookie },
      payload: { variantId: "019ffb44-731f-70b0-877d-e2a82f7971a6", quantity: 1 },
    });

    expect(response.statusCode).toBe(403);
  });

  it("rechaza una cabecera que no coincide con la cookie", async () => {
    const { cookie } = await obtenerToken();

    const response = await app.inject({
      method: "POST",
      url: "/v1/cart/items",
      cookies: { [CSRF_COOKIE]: cookie },
      headers: { [CSRF_HEADER]: "token-inventado-por-el-atacante" },
      payload: { variantId: "019ffb44-731f-70b0-877d-e2a82f7971a6", quantity: 1 },
    });

    expect(response.statusCode).toBe(403);
  });

  it("acepta la mutación cuando cookie y cabecera coinciden", async () => {
    const { token, cookie } = await obtenerToken();

    const response = await app.inject({
      method: "DELETE",
      url: "/v1/cart",
      cookies: { [CSRF_COOKIE]: cookie },
      headers: { [CSRF_HEADER]: token },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe("exenciones", () => {
  it("el webhook de Stripe NO exige token CSRF", async () => {
    // Stripe no conoce nuestro token y no lo necesita: se autentica por firma y
    // no viaja con cookies de nadie, así que no hay sesión que secuestrar.
    // Exigírselo rompería los pagos a cambio de nada.
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/stripe",
      headers: { "content-type": "application/json" },
      payload: "{}",
    });

    // 400 por firma ausente, NO 403 por CSRF: llegó a la comprobación de firma.
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "MISSING_SIGNATURE",
    );
  });

  it("las lecturas nunca piden token", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/products?limit=1" });
    expect(response.statusCode).toBe(200);
  });
});
