/**
 * Aislamiento del panel de administración.
 *
 * Este archivo prueba el requisito original del proyecto: que un cliente no
 * pueda acercarse al dashboard. Se verifica que las TRES capas funcionan por
 * separado, para que si una fallara en el futuro las otras sigan en pie:
 *
 *   1. Audiencia criptográfica del token
 *   2. Comprobación de rol
 *   3. Segundo factor obligatorio
 */

import { UserRole, prisma } from "@bodegon/db";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { decryptSecret } from "../../lib/crypto.js";
import { TOKEN_AUDIENCE, signAccessToken, verifyAccessToken } from "../../lib/jwt.js";
import { generateTotpCode } from "../../lib/totp.js";

const SUFIJO = "@prueba-admin.local";
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

function cookiesDe(response: { cookies: unknown[] }): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const cookie of response.cookies as { name: string; value: string }[]) {
    resultado[cookie.name] = cookie.value;
  }
  return resultado;
}

/** Crea un cliente normal con sesión iniciada. */
async function clienteConSesion(): Promise<{
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

/** Crea un admin con 2FA activo y sesión abierta en el panel. */
async function adminConSesion(): Promise<{
  email: string;
  cookies: Record<string, string>;
  secret: string;
}> {
  const email = correoUnico();
  await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: { email, password: CONTRASENA },
  });
  await prisma.user.updateMany({ where: { email }, data: { role: UserRole.ADMIN } });

  // Paso 1: contraseña. Como aún no tiene 2FA, pide configurarlo.
  const paso1 = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/login",
    payload: { email, password: CONTRASENA },
  });
  const { status, challengeToken } = paso1.json<{
    status: string;
    challengeToken: string;
  }>();
  expect(status).toBe("two_factor_setup_required");

  // Paso 2: generar el QR.
  await app.inject({
    method: "POST",
    url: "/v1/admin/auth/2fa/setup",
    payload: { challengeToken },
  });

  const user = await prisma.user.findFirstOrThrow({ where: { email } });
  const secret = decryptSecret(user.twoFactorSecret ?? "");

  // Paso 3: confirmar y abrir sesión.
  const confirmado = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/2fa/confirm",
    payload: { challengeToken, totpCode: await generateTotpCode(secret) },
  });

  return { email, cookies: cookiesDe(confirmado), secret };
}

describe("capa 1 — audiencia criptográfica", () => {
  it("un token de cliente NO se puede verificar como token de admin", async () => {
    const token = await signAccessToken({
      sub: "cualquier-id",
      role: UserRole.CUSTOMER,
      aud: TOKEN_AUDIENCE.customer,
    });

    // La verificación falla en la FIRMA, antes de mirar el rol.
    await expect(verifyAccessToken(token, TOKEN_AUDIENCE.admin)).rejects.toThrow();
    // Y el mismo token sí vale en su propio mundo.
    await expect(verifyAccessToken(token, TOKEN_AUDIENCE.customer)).resolves.toBeTruthy();
  });

  it("un token de admin tampoco sirve en las rutas de cliente", async () => {
    const token = await signAccessToken({
      sub: "cualquier-id",
      role: UserRole.ADMIN,
      aud: TOKEN_AUDIENCE.admin,
    });

    // El aislamiento va en las dos direcciones.
    await expect(verifyAccessToken(token, TOKEN_AUDIENCE.customer)).rejects.toThrow();
  });

  it("la sesión de un cliente no abre el panel", async () => {
    const { cookies } = await clienteConSesion();

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/auth/me",
      cookies,
    });

    // 401 y no 403: el token ni siquiera llega a identificarse.
    expect(response.statusCode).toBe(401);
  });
});

describe("capa 2 — comprobación de rol", () => {
  it("un CUSTOMER con contraseña correcta no entra al panel", async () => {
    const { email } = await clienteConSesion();

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: { email, password: CONTRASENA },
    });

    expect(response.statusCode).toBe(401);
    // Mismo mensaje que una contraseña equivocada: no confirmamos que la
    // cuenta exista ni que la contraseña fuera buena.
    expect(response.json<{ error: { message: string } }>().error.message).toBe(
      "Credenciales incorrectas",
    );
  });

  it("el intento queda en el registro de auditoría", async () => {
    const { email } = await clienteConSesion();
    const user = await prisma.user.findFirstOrThrow({ where: { email } });

    await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: { email, password: CONTRASENA },
    });

    const registros = await prisma.auditLog.findMany({
      where: { actorId: user.id, action: "security.unauthorized_access" },
    });

    // Un intento es ruido; cincuenta desde la misma IP son un ataque, y solo
    // se ve si queda registrado.
    expect(registros.length).toBeGreaterThan(0);
    expect(registros[0]?.entityType).toBe("AdminPanel");
  });

  it("un token de admin con rol CUSTOMER en la base tampoco pasa", async () => {
    // Escenario: a alguien se le degradó el rol después de emitirle el token.
    const { email } = await clienteConSesion();
    const user = await prisma.user.findFirstOrThrow({ where: { email } });

    // Se fabrica un token con la audiencia correcta a propósito, para probar
    // que la capa de rol funciona SOLA, sin apoyarse en la audiencia.
    const token = await signAccessToken({
      sub: user.id,
      role: UserRole.ADMIN, // el token miente
      aud: TOKEN_AUDIENCE.admin,
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    // El rol se relee de la base en cada petición: el del token no manda.
    expect(response.statusCode).toBe(403);
  });
});

describe("capa 3 — segundo factor obligatorio", () => {
  it("el login de admin NUNCA entrega sesión en el primer paso", async () => {
    const email = correoUnico();
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password: CONTRASENA },
    });
    await prisma.user.updateMany({ where: { email }, data: { role: UserRole.ADMIN } });

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: { email, password: CONTRASENA },
    });

    expect(response.statusCode).toBe(200);
    // Sin 2FA configurado, obliga a activarlo antes de dejar pasar.
    expect(response.json<{ status: string }>().status).toBe("two_factor_setup_required");
    // Y no entrega ninguna cookie de sesión.
    expect(response.cookies).toHaveLength(0);
  });

  it("un admin sin 2FA no puede usar el panel aunque tenga token válido", async () => {
    const email = correoUnico();
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password: CONTRASENA },
    });
    await prisma.user.updateMany({ where: { email }, data: { role: UserRole.ADMIN } });
    const user = await prisma.user.findFirstOrThrow({ where: { email } });

    // Token con audiencia y rol correctos, pero la cuenta no tiene 2FA.
    const token = await signAccessToken({
      sub: user.id,
      role: UserRole.ADMIN,
      aud: TOKEN_AUDIENCE.admin,
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { message: string } }>().error.message).toContain(
      "segundo factor",
    );
  });
});

describe("flujo completo de administrador", () => {
  it("activa el 2FA en el primer acceso y entra al panel", async () => {
    const { email, cookies } = await adminConSesion();

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/auth/me",
      cookies,
    });

    expect(response.statusCode).toBe(200);
    const perfil = response.json<{ email: string; role: string }>();
    expect(perfil.email).toBe(email);
    expect(perfil.role).toBe("ADMIN");
  });

  it("registra el acceso correcto en la auditoría", async () => {
    const { email } = await adminConSesion();
    const user = await prisma.user.findFirstOrThrow({ where: { email } });

    const registros = await prisma.auditLog.findMany({
      where: { actorId: user.id },
      orderBy: { createdAt: "asc" },
    });

    const acciones = registros.map((r) => r.action);
    expect(acciones).toContain("admin.2fa.enabled");
  });

  it("la sesión de admin NO abre las rutas de cliente", async () => {
    const { cookies } = await adminConSesion();

    // El token es de audiencia "admin": en /v1/auth/me falla la verificación.
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      cookies,
    });

    expect(response.statusCode).toBe(401);
  });

  it("un segundo login ya solo pide el código, no la configuración", async () => {
    const { email, secret } = await adminConSesion();

    const paso1 = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: { email, password: CONTRASENA },
    });
    const cuerpo = paso1.json<{ status: string; challengeToken: string }>();
    expect(cuerpo.status).toBe("two_factor_required");

    const paso2 = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login/2fa",
      payload: {
        challengeToken: cuerpo.challengeToken,
        totpCode: await generateTotpCode(secret, 30),
      },
    });

    expect(paso2.statusCode).toBe(200);
    expect(paso2.json<{ status: string }>().status).toBe("authenticated");
  });
});

describe("registro de auditoría", () => {
  it("sobrevive al borrado del usuario que actuó", async () => {
    const { email } = await adminConSesion();
    const user = await prisma.user.findFirstOrThrow({ where: { email } });

    const antes = await prisma.auditLog.count({ where: { actorId: user.id } });
    expect(antes).toBeGreaterThan(0);

    await prisma.user.delete({ where: { id: user.id } });

    // actorId no tiene relación con User a propósito: borrar la cuenta no
    // borra la evidencia de lo que hizo.
    const despues = await prisma.auditLog.count({ where: { actorId: user.id } });
    expect(despues).toBe(antes);
  });

  it("nunca guarda contraseñas ni tokens", async () => {
    const email = correoUnico();
    await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: { email, password: CONTRASENA },
    });

    const registros = await prisma.auditLog.findMany({
      where: { action: "admin.login.failed" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    for (const registro of registros) {
      const serializado = JSON.stringify(registro.metadata);
      expect(serializado).not.toContain(CONTRASENA);
      expect(serializado).not.toContain("argon2");
    }
  });
});
