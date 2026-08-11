/**
 * Tests del servicio de autenticación.
 *
 * Se prueban las PROPIEDADES DE SEGURIDAD, no el camino feliz: que el registro
 * no revele si un correo ya tiene cuenta, que todos los fallos de login den el
 * mismo mensaje, que el bloqueo no confirme una contraseña acertada.
 *
 * Corren contra la base real, sobre usuarios de prueba que se limpian al final.
 */

import { prisma } from "@bodegon/db";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Mailer } from "../../lib/mailer.js";
import * as authService from "./auth.service.js";

/** Mailer de mentira: registra las llamadas en vez de enviar nada. */
function crearMailerFalso(): Mailer & { llamadas: Record<string, string[]> } {
  const llamadas: Record<string, string[]> = {
    verification: [],
    passwordReset: [],
    duplicate: [],
    locked: [],
    sessionRevoked: [],
  };
  return {
    llamadas,
    sendVerificationEmail(to, token) {
      llamadas.verification?.push(`${to}:${token}`);
      return Promise.resolve();
    },
    sendPasswordResetEmail(to, token) {
      llamadas.passwordReset?.push(`${to}:${token}`);
      return Promise.resolve();
    },
    sendDuplicateRegistrationNotice(to) {
      llamadas.duplicate?.push(to);
      return Promise.resolve();
    },
    sendAccountLockedNotice(to) {
      llamadas.locked?.push(to);
      return Promise.resolve();
    },
    sendSessionRevokedNotice(to) {
      llamadas.sessionRevoked?.push(to);
      return Promise.resolve();
    },
  };
}

const CONTRASENA = "una contraseña larga y buena";
const CONTEXTO = { ip: "127.0.0.1", userAgent: "vitest" };
const SUFIJO = "@prueba-auth.local";

let mailer: ReturnType<typeof crearMailerFalso>;

beforeEach(() => {
  mailer = crearMailerFalso();
});

async function limpiarUsuariosDePrueba(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFIJO } } });
}

afterEach(limpiarUsuariosDePrueba);

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await prisma.$disconnect();
});

function correoUnico(): string {
  return `u${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}${SUFIJO}`;
}

describe("registro", () => {
  it("crea la cuenta y envía la verificación", async () => {
    const email = correoUnico();

    await authService.register({ email, password: CONTRASENA }, mailer);

    const user = await prisma.user.findFirst({ where: { email } });
    expect(user).not.toBeNull();
    // Nunca la contraseña en claro.
    expect(user?.passwordHash).not.toContain(CONTRASENA);
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    // Nace sin verificar y como cliente.
    expect(user?.emailVerifiedAt).toBeNull();
    expect(user?.role).toBe("CUSTOMER");
    expect(mailer.llamadas.verification).toHaveLength(1);
  });

  it("no revela que un correo ya tiene cuenta", async () => {
    const email = correoUnico();
    await authService.register({ email, password: CONTRASENA }, mailer);

    const segundoMailer = crearMailerFalso();
    // El segundo registro no lanza: responde igual que el primero.
    await expect(
      authService.register({ email, password: "otra contraseña larga" }, segundoMailer),
    ).resolves.toBeUndefined();

    // No se creó una segunda cuenta ni se cambió la contraseña de la primera.
    const usuarios = await prisma.user.findMany({ where: { email } });
    expect(usuarios).toHaveLength(1);

    // Al dueño real sí se le avisa, por un canal que solo él controla.
    expect(segundoMailer.llamadas.duplicate).toEqual([email]);
    expect(segundoMailer.llamadas.verification).toHaveLength(0);
  });

  it("tarda parecido exista o no el correo", async () => {
    const existente = correoUnico();
    await authService.register({ email: existente, password: CONTRASENA }, mailer);

    const medir = async (email: string): Promise<number> => {
      const inicio = process.hrtime.bigint();
      await authService.register({ email, password: CONTRASENA }, crearMailerFalso());
      return Number(process.hrtime.bigint() - inicio) / 1e6;
    };

    const conExistente = await medir(existente);
    const conNuevo = await medir(correoUnico());

    // Ambos caminos hashean antes de consultar, así que ninguno es
    // instantáneo. Sin esa precaución, "ya existe" respondería en ~0 ms.
    expect(conExistente).toBeGreaterThan(5);
    expect(conNuevo).toBeGreaterThan(5);
  });
});

describe("login", () => {
  async function crearUsuario(): Promise<string> {
    const email = correoUnico();
    await authService.register({ email, password: CONTRASENA }, mailer);
    return email;
  }

  it("autentica con credenciales correctas y entrega tokens", async () => {
    const email = await crearUsuario();

    const resultado = await authService.login(
      { email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );

    expect(resultado.status).toBe("authenticated");
    if (resultado.status !== "authenticated") return;

    expect(resultado.tokens.accessToken.split(".")).toHaveLength(3); // es un JWT
    expect(resultado.tokens.refreshToken.length).toBeGreaterThan(40);

    // El refresh token se guarda HASHEADO, nunca en claro.
    const guardados = await prisma.refreshToken.findMany({
      where: { userId: resultado.user.id },
    });
    expect(guardados).toHaveLength(1);
    expect(guardados[0]?.tokenHash).not.toBe(resultado.tokens.refreshToken);
  });

  it("da el mismo mensaje si el correo no existe que si la contraseña falla", async () => {
    const email = await crearUsuario();

    const errorCorreoInexistente = await authService
      .login({ email: correoUnico(), password: CONTRASENA }, CONTEXTO, mailer)
      .catch((error: unknown) => error);

    const errorContrasenaMala = await authService
      .login({ email, password: "contraseña equivocada" }, CONTEXTO, mailer)
      .catch((error: unknown) => error);

    // Si los mensajes difirieran, comparándolos se construye la lista de
    // clientes de la tienda sin conocer ninguna contraseña.
    expect((errorCorreoInexistente as Error).message).toBe(
      (errorContrasenaMala as Error).message,
    );
    expect((errorCorreoInexistente as { statusCode: number }).statusCode).toBe(401);
  });

  it("tarda parecido con correo inexistente que con contraseña incorrecta", async () => {
    const email = await crearUsuario();

    const medir = async (datos: { email: string; password: string }): Promise<number> => {
      const inicio = process.hrtime.bigint();
      await authService.login(datos, CONTEXTO, mailer).catch(() => undefined);
      return Number(process.hrtime.bigint() - inicio) / 1e6;
    };

    const inexistente = await medir({ email: correoUnico(), password: CONTRASENA });
    const contrasenaMala = await medir({ email, password: "equivocada" });

    // El señuelo iguala los tiempos. Sin él serían ~0 ms contra ~15 ms.
    expect(inexistente).toBeGreaterThan(contrasenaMala * 0.5);
  });

  it("bloquea la cuenta tras 5 intentos fallidos y avisa al dueño", async () => {
    const email = await crearUsuario();

    for (let i = 0; i < 5; i++) {
      await authService
        .login({ email, password: "equivocada" }, CONTEXTO, mailer)
        .catch(() => undefined);
    }

    const user = await prisma.user.findFirst({ where: { email } });
    expect(user?.failedLoginAttempts).toBe(5);
    expect(user?.lockedUntil).not.toBeNull();
    expect(user?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());

    // La respuesta HTTP es genérica, pero al dueño se le avisa por correo.
    expect(mailer.llamadas.locked).toEqual([email]);
  });

  it("con la cuenta bloqueada NO confirma que la contraseña era correcta", async () => {
    const email = await crearUsuario();

    for (let i = 0; i < 5; i++) {
      await authService
        .login({ email, password: "equivocada" }, CONTEXTO, mailer)
        .catch(() => undefined);
    }

    // Ahora se prueba la contraseña BUENA con la cuenta bloqueada.
    const error = await authService
      .login({ email, password: CONTRASENA }, CONTEXTO, mailer)
      .catch((e: unknown) => e);

    // Si dijera "cuenta bloqueada", el atacante sabría que acertó la
    // contraseña y podría reusarla donde la víctima la repita.
    expect((error as Error).message).toBe("Correo o contraseña incorrectos");
  });

  it("reinicia el contador tras un login correcto", async () => {
    const email = await crearUsuario();

    for (let i = 0; i < 3; i++) {
      await authService
        .login({ email, password: "equivocada" }, CONTEXTO, mailer)
        .catch(() => undefined);
    }

    await authService.login({ email, password: CONTRASENA }, CONTEXTO, mailer);

    const user = await prisma.user.findFirst({ where: { email } });
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lockedUntil).toBeNull();
  });
});

describe("verificación de correo", () => {
  it("marca el correo como verificado con un token válido", async () => {
    const email = correoUnico();
    await authService.register({ email, password: CONTRASENA }, mailer);

    const enviado = mailer.llamadas.verification?.[0] ?? "";
    const token = enviado.slice(enviado.indexOf(":") + 1);

    await authService.verifyEmail(token);

    const user = await prisma.user.findFirst({ where: { email } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it("rechaza un token ya usado", async () => {
    const email = correoUnico();
    await authService.register({ email, password: CONTRASENA }, mailer);

    const enviado = mailer.llamadas.verification?.[0] ?? "";
    const token = enviado.slice(enviado.indexOf(":") + 1);

    await authService.verifyEmail(token);
    // Un enlace de un solo uso: el segundo intento falla.
    await expect(authService.verifyEmail(token)).rejects.toThrow();
  });

  it("rechaza un token inventado", async () => {
    await expect(authService.verifyEmail("token-que-nadie-emitio")).rejects.toThrow();
  });
});

describe("perfil público", () => {
  it("nunca expone el hash ni los secretos", async () => {
    const email = correoUnico();
    await authService.register({ email, password: CONTRASENA }, mailer);
    const user = await prisma.user.findFirstOrThrow({ where: { email } });

    const perfil = authService.toProfile(user);
    const serializado = JSON.stringify(perfil);

    expect(serializado).not.toContain("passwordHash");
    expect(serializado).not.toContain("argon2");
    expect(serializado).not.toContain("twoFactorSecret");
    expect(perfil.email).toBe(email);
  });
});
