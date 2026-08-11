/**
 * Rotación de refresh tokens y detección de reuso (control de seguridad nº 3).
 *
 * El escenario central de este archivo es un ROBO DE SESIÓN simulado: se copia
 * un token, el usuario legítimo lo rota, y el ladrón intenta usar la copia.
 * Debe saltar la alarma y cerrarse la familia entera.
 */

import { prisma } from "@bodegon/db";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Mailer } from "../../lib/mailer.js";
import * as authService from "./auth.service.js";

function crearMailerFalso(): Mailer & { revocaciones: string[] } {
  const revocaciones: string[] = [];
  return {
    revocaciones,
    sendVerificationEmail: () => Promise.resolve(),
    sendPasswordResetEmail: () => Promise.resolve(),
    sendDuplicateRegistrationNotice: () => Promise.resolve(),
    sendAccountLockedNotice: () => Promise.resolve(),
    sendSessionRevokedNotice(to) {
      revocaciones.push(to);
      return Promise.resolve();
    },
  };
}

const CONTRASENA = "una contraseña larga y buena";
const CONTEXTO = { ip: "127.0.0.1", userAgent: "vitest" };
const SUFIJO = "@prueba-rotacion.local";

let mailer: ReturnType<typeof crearMailerFalso>;

beforeEach(() => {
  mailer = crearMailerFalso();
});

async function limpiar(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFIJO } } });
}

afterEach(limpiar);
afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

/** Crea un usuario e inicia sesión. Devuelve el email y los tokens. */
async function usuarioConSesion(): Promise<{
  email: string;
  tokens: authService.SessionTokens;
}> {
  const email = `u${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}${SUFIJO}`;
  await authService.register({ email, password: CONTRASENA }, mailer);

  const resultado = await authService.login(
    { email, password: CONTRASENA },
    CONTEXTO,
    mailer,
  );
  if (resultado.status !== "authenticated") throw new Error("esperaba autenticación");

  return { email, tokens: resultado.tokens };
}

describe("rotación normal", () => {
  it("entrega un token nuevo y mata el anterior", async () => {
    const { tokens } = await usuarioConSesion();

    const nuevos = await authService.refreshSession(
      tokens.refreshToken,
      CONTEXTO,
      mailer,
    );

    expect(nuevos.refreshToken).not.toBe(tokens.refreshToken);
    expect(nuevos.accessToken.split(".")).toHaveLength(3);

    const viejo = await prisma.refreshToken.findUnique({
      where: { id: tokens.refreshTokenId },
    });
    expect(viejo?.revokedAt).not.toBeNull();
    // Deja el rastro de qué token lo sustituyó.
    expect(viejo?.replacedById).toBe(nuevos.refreshTokenId);
  });

  it("mantiene la misma familia a lo largo de la cadena", async () => {
    const { tokens } = await usuarioConSesion();

    const segundo = await authService.refreshSession(
      tokens.refreshToken,
      CONTEXTO,
      mailer,
    );
    const tercero = await authService.refreshSession(
      segundo.refreshToken,
      CONTEXTO,
      mailer,
    );

    const filas = await prisma.refreshToken.findMany({
      where: {
        id: {
          in: [tokens.refreshTokenId, segundo.refreshTokenId, tercero.refreshTokenId],
        },
      },
    });

    const familias = new Set(filas.map((fila) => fila.familyId));
    expect(familias.size).toBe(1);
  });

  it("permite encadenar varias rotaciones seguidas", async () => {
    const { tokens } = await usuarioConSesion();

    let actual = tokens.refreshToken;
    for (let i = 0; i < 5; i++) {
      const nuevos = await authService.refreshSession(actual, CONTEXTO, mailer);
      actual = nuevos.refreshToken;
    }

    // Ninguna rotación legítima dispara la alarma.
    expect(mailer.revocaciones).toHaveLength(0);
  });
});

describe("detección de reuso — robo de sesión simulado", () => {
  it("revoca la familia entera cuando reaparece un token ya rotado", async () => {
    const { email, tokens } = await usuarioConSesion();

    // 🕵️ El atacante copia el refresh token.
    const tokenRobado = tokens.refreshToken;

    // El usuario legítimo lo usa: rota y recibe uno nuevo.
    const legitimos = await authService.refreshSession(tokenRobado, CONTEXTO, mailer);

    // 🚨 El atacante intenta usar su copia, que ya está muerta.
    await expect(
      authService.refreshSession(tokenRobado, CONTEXTO, mailer),
    ).rejects.toThrow();

    // La respuesta es que TODA la familia queda revocada: el atacante fuera...
    const familia = await prisma.refreshToken.findMany({
      where: {
        familyId: (
          await prisma.refreshToken.findUniqueOrThrow({
            where: { id: tokens.refreshTokenId },
          })
        ).familyId,
      },
    });
    for (const fila of familia) {
      expect(fila.revokedAt).not.toBeNull();
    }

    // ...y el usuario legítimo también, porque no sabemos cuál es cuál.
    await expect(
      authService.refreshSession(legitimos.refreshToken, CONTEXTO, mailer),
    ).rejects.toThrow();

    // Al dueño se le avisa por correo: el robo silencioso se vuelve alarma.
    expect(mailer.revocaciones).toContain(email);
  });

  it("el usuario legítimo puede volver a entrar con su contraseña", async () => {
    const { email, tokens } = await usuarioConSesion();

    const tokenRobado = tokens.refreshToken;
    await authService.refreshSession(tokenRobado, CONTEXTO, mailer);
    await authService
      .refreshSession(tokenRobado, CONTEXTO, mailer)
      .catch(() => undefined);

    // Esta es la asimetría que hace útil la defensa: el dueño tiene la
    // contraseña y el ladrón no.
    const resultado = await authService.login(
      { email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    expect(resultado.status).toBe("authenticated");
  });

  it("no revela que se detectó un reuso", async () => {
    const { tokens } = await usuarioConSesion();

    await authService.refreshSession(tokens.refreshToken, CONTEXTO, mailer);

    const errorReuso = await authService
      .refreshSession(tokens.refreshToken, CONTEXTO, mailer)
      .catch((e: unknown) => e);

    const errorInventado = await authService
      .refreshSession("token-que-nadie-emitio-jamas", CONTEXTO, mailer)
      .catch((e: unknown) => e);

    // Si el mensaje difiriera, el atacante sabría que su token era auténtico
    // y que fuimos nosotros quienes cerramos la sesión.
    expect((errorReuso as Error).message).toBe((errorInventado as Error).message);
  });

  it("una sesión de otro dispositivo sobrevive al incidente", async () => {
    const { email, tokens } = await usuarioConSesion();

    // Segundo inicio de sesión = familia distinta (otro dispositivo).
    const otro = await authService.login(
      { email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (otro.status !== "authenticated") throw new Error("esperaba autenticación");

    // Se compromete la primera sesión.
    await authService.refreshSession(tokens.refreshToken, CONTEXTO, mailer);
    await authService
      .refreshSession(tokens.refreshToken, CONTEXTO, mailer)
      .catch(() => undefined);

    // La otra familia sigue viva: revocar es quirúrgico, no arrasa con todo.
    const nuevos = await authService.refreshSession(
      otro.tokens.refreshToken,
      CONTEXTO,
      mailer,
    );
    expect(nuevos.refreshToken).toBeTruthy();
  });
});

describe("tokens inválidos", () => {
  it("rechaza un token que nunca existió", async () => {
    await expect(
      authService.refreshSession("inventado-por-completo", CONTEXTO, mailer),
    ).rejects.toThrow();
  });

  it("rechaza un token caducado", async () => {
    const { tokens } = await usuarioConSesion();

    await prisma.refreshToken.update({
      where: { id: tokens.refreshTokenId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      authService.refreshSession(tokens.refreshToken, CONTEXTO, mailer),
    ).rejects.toThrow();
  });

  it("rechaza la sesión si la cuenta fue archivada", async () => {
    const { email, tokens } = await usuarioConSesion();

    await prisma.user.updateMany({
      where: { email },
      data: { deletedAt: new Date() },
    });

    await expect(
      authService.refreshSession(tokens.refreshToken, CONTEXTO, mailer),
    ).rejects.toThrow();
  });
});

describe("cierre de sesión", () => {
  it("logout revoca solo la sesión actual", async () => {
    const { tokens } = await usuarioConSesion();

    await authService.logout(tokens.refreshToken);

    await expect(
      authService.refreshSession(tokens.refreshToken, CONTEXTO, mailer),
    ).rejects.toThrow();
  });

  it("logoutAll cierra todos los dispositivos", async () => {
    const { email, tokens } = await usuarioConSesion();
    const otro = await authService.login(
      { email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (otro.status !== "authenticated") throw new Error("esperaba autenticación");

    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    await authService.logoutAll(user.id);

    await expect(
      authService.refreshSession(tokens.refreshToken, CONTEXTO, mailer),
    ).rejects.toThrow();
    await expect(
      authService.refreshSession(otro.tokens.refreshToken, CONTEXTO, mailer),
    ).rejects.toThrow();
  });
});
