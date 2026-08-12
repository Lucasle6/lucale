/**
 * Endpoints de autenticación, probados por HTTP con app.inject().
 *
 * Complementa los tests de servicio: aquí se verifica lo que solo existe en la
 * capa HTTP — cookies httpOnly, códigos de estado, rate limiting y que los
 * tokens NUNCA aparezcan en el cuerpo de la respuesta.
 */

import { prisma } from "@bodegon/db";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { generateTotpCode } from "../../lib/totp.js";
import { decryptSecret } from "../../lib/crypto.js";

const SUFIJO = "@prueba-rutas.local";
const CONTRASENA = "mi perro se llama canela";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFIJO } } });
  await prisma.$disconnect();
});

function correoUnico(): string {
  return `u${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}${SUFIJO}`;
}

/** Extrae las cookies de una respuesta para reenviarlas en la siguiente. */
function cookiesDe(response: { cookies: unknown[] }): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const cookie of response.cookies as { name: string; value: string }[]) {
    resultado[cookie.name] = cookie.value;
  }
  return resultado;
}

async function registrarYEntrar(): Promise<{
  email: string;
  cookies: Record<string, string>;
}> {
  const email = correoUnico();
  await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: { email, password: CONTRASENA },
  });

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: CONTRASENA },
  });

  return { email, cookies: cookiesDe(login) };
}

describe("POST /v1/auth/register", () => {
  it("acepta el registro con 202 y mensaje genérico", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: correoUnico(), password: CONTRASENA },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json<{ message: string }>().message).toContain("Si el correo");
  });

  it("responde EXACTAMENTE igual si el correo ya existe", async () => {
    const email = correoUnico();
    const primera = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password: CONTRASENA },
    });
    const segunda = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password: "otra contraseña larga" },
    });

    // Si difirieran, este endpoint sería un buscador de clientes.
    expect(segunda.statusCode).toBe(primera.statusCode);
    expect(segunda.body).toBe(primera.body);
  });

  it("rechaza contraseñas cortas o filtradas", async () => {
    const corta = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: correoUnico(), password: "corta" },
    });
    expect(corta.statusCode).toBe(400);

    const comun = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: correoUnico(), password: "contrasena123" },
    });
    expect(comun.statusCode).toBe(400);
  });
});

describe("POST /v1/auth/login", () => {
  it("entrega los tokens SOLO en cookies httpOnly", async () => {
    const email = correoUnico();
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password: CONTRASENA },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: CONTRASENA },
    });

    expect(response.statusCode).toBe(200);

    const cookies = response.cookies as {
      name: string;
      httpOnly?: boolean;
      sameSite?: string;
    }[];
    const access = cookies.find((c) => c.name === "access_token");
    const refresh = cookies.find((c) => c.name === "refresh_token");

    expect(access?.httpOnly).toBe(true);
    expect(refresh?.httpOnly).toBe(true);
    expect(access?.sameSite?.toLowerCase()).toBe("strict");

    // Un XSS no debe poder leer el token: por eso no viaja en el cuerpo.
    expect(response.body).not.toContain("eyJ");
  });

  it("da la misma respuesta con correo inexistente que con contraseña mala", async () => {
    const email = correoUnico();
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password: CONTRASENA },
    });

    const contrasenaMala = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "equivocada del todo" },
    });
    const correoInexistente = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: correoUnico(), password: CONTRASENA },
    });

    expect(correoInexistente.statusCode).toBe(contrasenaMala.statusCode);

    const mensajeDe = (respuesta: { json: <T>() => T }): string =>
      respuesta.json<{ error: { message: string } }>().error.message;

    expect(mensajeDe(correoInexistente)).toBe("Correo o contraseña incorrectos");
    expect(mensajeDe(correoInexistente)).toBe(mensajeDe(contrasenaMala));
  });
});

describe("rutas protegidas", () => {
  it("GET /auth/me exige sesión", async () => {
    const sinCookie = await app.inject({ method: "GET", url: "/v1/auth/me" });
    expect(sinCookie.statusCode).toBe(401);
  });

  it("GET /auth/me devuelve el perfil sin datos sensibles", async () => {
    const { email, cookies } = await registrarYEntrar();

    const response = await app.inject({ method: "GET", url: "/v1/auth/me", cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ email: string }>().email).toBe(email);
    // Nunca el hash ni los secretos.
    expect(response.body).not.toContain("argon2");
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("twoFactorSecret");
  });

  it("rechaza un token con firma inválida", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.falso.firma" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("segundo factor por HTTP", () => {
  it("recorre el flujo completo: setup, confirm y login en dos pasos", async () => {
    const { email, cookies } = await registrarYEntrar();

    // 1. Pedir el QR.
    const setup = await app.inject({
      method: "POST",
      url: "/v1/auth/2fa/setup",
      cookies,
    });
    expect(setup.statusCode).toBe(200);
    expect(setup.json<{ qrDataUrl: string }>().qrDataUrl).toMatch(/^data:image\/png/);

    // 2. Confirmar con un código real.
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    const secret = decryptSecret(user.twoFactorSecret ?? "");

    const confirm = await app.inject({
      method: "POST",
      url: "/v1/auth/2fa/confirm",
      cookies,
      payload: { totpCode: await generateTotpCode(secret) },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json<{ backupCodes: string[] }>().backupCodes).toHaveLength(10);

    // 3. Ahora la contraseña sola ya no basta.
    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: CONTRASENA },
    });
    const cuerpo = login.json<{ status: string; challengeToken?: string }>();
    expect(cuerpo.status).toBe("two_factor_required");
    // Y no entrega ninguna cookie de sesión todavía.
    expect(login.cookies).toHaveLength(0);

    // 4. Segundo paso con el código.
    const paso2 = await app.inject({
      method: "POST",
      url: "/v1/auth/login/2fa",
      payload: {
        challengeToken: cuerpo.challengeToken,
        totpCode: await generateTotpCode(secret, 30),
      },
    });
    expect(paso2.statusCode).toBe(200);
    expect(paso2.json<{ status: string }>().status).toBe("authenticated");
  });

  it("no se puede completar el 2FA sin un challenge válido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login/2fa",
      payload: { challengeToken: "a".repeat(30), totpCode: "123456" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("recuperación de contraseña", () => {
  it("responde igual exista o no el correo", async () => {
    const { email } = await registrarYEntrar();

    const existente = await app.inject({
      method: "POST",
      url: "/v1/auth/password/forgot",
      payload: { email },
    });
    const inexistente = await app.inject({
      method: "POST",
      url: "/v1/auth/password/forgot",
      payload: { email: correoUnico() },
    });

    expect(existente.statusCode).toBe(202);
    expect(inexistente.statusCode).toBe(202);
    expect(inexistente.body).toBe(existente.body);
  });

  it("rechaza un token de reseteo inventado", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/password/reset",
      payload: { token: "x".repeat(43), password: CONTRASENA },
    });
    expect(response.statusCode).toBe(409);
  });
});

describe("cierre de sesión", () => {
  it("borra las cookies", async () => {
    const { cookies } = await registrarYEntrar();

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      cookies,
    });

    expect(response.statusCode).toBe(200);
    const borradas = response.cookies as { name: string; value: string }[];
    for (const cookie of borradas) {
      expect(cookie.value).toBe("");
    }
  });
});
