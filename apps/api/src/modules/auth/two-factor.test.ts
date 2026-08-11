/**
 * Segundo factor: activación, verificación y códigos de respaldo.
 *
 * Lo que se prueba son las propiedades de seguridad: que el secreto viaje
 * cifrado, que un código no se pueda reusar, que no se pueda saltar el primer
 * factor, y que perder el teléfono no signifique perder la cuenta.
 */

import { prisma } from "@bodegon/db";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret } from "../../lib/crypto.js";
import type { Mailer } from "../../lib/mailer.js";
import { generateTotpCode } from "../../lib/totp.js";

/**
 * Al confirmar el 2FA se consume el periodo del código usado, para que ese
 * mismo código no valga luego como login. Eso deja un hueco real de hasta 30 s
 * antes de poder iniciar sesión — inofensivo en producción, porque tras
 * activar el 2FA ya estás dentro.
 *
 * Los tests no pueden esperar 30 s, así que piden el código del periodo
 * siguiente.
 */
const SIGUIENTE_PERIODO = 30;
import * as authService from "./auth.service.js";
import * as twoFactor from "./two-factor.service.js";

function mailerFalso(): Mailer {
  return {
    sendVerificationEmail: () => Promise.resolve(),
    sendPasswordResetEmail: () => Promise.resolve(),
    sendDuplicateRegistrationNotice: () => Promise.resolve(),
    sendAccountLockedNotice: () => Promise.resolve(),
    sendSessionRevokedNotice: () => Promise.resolve(),
  };
}

const CONTRASENA = "una contraseña larga y buena";
const CONTEXTO = { ip: "127.0.0.1", userAgent: "vitest" };
const SUFIJO = "@prueba-2fa.local";

let mailer: Mailer;

beforeEach(() => {
  mailer = mailerFalso();
});

async function limpiar(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFIJO } } });
}

afterEach(limpiar);
afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

async function crearUsuario() {
  const email = `u${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}${SUFIJO}`;
  await authService.register({ email, password: CONTRASENA }, mailer);
  return prisma.user.findFirstOrThrow({ where: { email } });
}

/** Crea un usuario con 2FA ya activo. Devuelve el usuario, el secreto y los códigos. */
async function usuarioCon2FA() {
  const user = await crearUsuario();
  await twoFactor.setup(user);

  const conSecreto = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
  const secret = decryptSecret(conSecreto.twoFactorSecret ?? "");

  const codigos = await twoFactor.confirm(conSecreto, await generateTotpCode(secret));
  const activo = await prisma.user.findFirstOrThrow({ where: { id: user.id } });

  return { user: activo, secret, codigosDeRespaldo: codigos };
}

describe("activación", () => {
  it("entrega un QR y guarda el secreto CIFRADO", async () => {
    const user = await crearUsuario();

    const setup = await twoFactor.setup(user);

    expect(setup.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(setup.manualEntryKey).toMatch(/^[A-Z2-7]+$/); // base32

    const guardado = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
    // En la base nunca está en claro.
    expect(guardado.twoFactorSecret).not.toBe(setup.manualEntryKey);
    expect(guardado.twoFactorSecret).toContain(":"); // formato iv:tag:datos
    // Pero el servidor sí puede recuperarlo: se cifra, no se hashea.
    expect(decryptSecret(guardado.twoFactorSecret ?? "")).toBe(setup.manualEntryKey);
  });

  it("NO activa el 2FA hasta que se confirma con un código real", async () => {
    const user = await crearUsuario();

    await twoFactor.setup(user);

    const trasSetup = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
    // Sin este paso, alguien podría activar el 2FA sin haber escaneado bien el
    // QR y quedarse fuera de su propia cuenta para siempre.
    expect(trasSetup.twoFactorEnabledAt).toBeNull();
  });

  it("rechaza la confirmación con un código equivocado", async () => {
    const user = await crearUsuario();
    await twoFactor.setup(user);
    const conSecreto = await prisma.user.findFirstOrThrow({ where: { id: user.id } });

    await expect(twoFactor.confirm(conSecreto, "000000")).rejects.toThrow();

    const sinActivar = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
    expect(sinActivar.twoFactorEnabledAt).toBeNull();
  });

  it("activa el 2FA y entrega 10 códigos de respaldo", async () => {
    const { user, codigosDeRespaldo } = await usuarioCon2FA();

    expect(user.twoFactorEnabledAt).not.toBeNull();
    expect(codigosDeRespaldo).toHaveLength(10);
    for (const codigo of codigosDeRespaldo) {
      expect(codigo).toMatch(/^\d{5}-\d{5}$/);
    }

    // En la base están hasheados: ni nosotros podemos recuperarlos.
    const guardados = await prisma.backupCode.findMany({ where: { userId: user.id } });
    expect(guardados).toHaveLength(10);
    for (const fila of guardados) {
      expect(codigosDeRespaldo).not.toContain(fila.codeHash);
    }
  });
});

describe("login con segundo factor", () => {
  it("la contraseña sola ya no basta", async () => {
    const { user } = await usuarioCon2FA();

    const resultado = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );

    // No entrega tokens: solo un challenge para el segundo paso.
    expect(resultado.status).toBe("two_factor_required");
    if (resultado.status !== "two_factor_required") return;
    expect(resultado.challengeToken.split(".")).toHaveLength(3);
  });

  it("completa el login con el código de la app", async () => {
    const { user, secret } = await usuarioCon2FA();

    const paso1 = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (paso1.status !== "two_factor_required") throw new Error("esperaba 2FA");

    const paso2 = await authService.completeTwoFactorLogin(
      paso1.challengeToken,
      { totpCode: await generateTotpCode(secret, SIGUIENTE_PERIODO) },
      CONTEXTO,
    );

    expect(paso2.tokens.accessToken.split(".")).toHaveLength(3);
    expect(paso2.user.id).toBe(user.id);
  });

  it("NO se puede saltar el primer factor sin el challenge", async () => {
    const { secret } = await usuarioCon2FA();

    // Sin el challengeToken, bastaría adivinar un número entre un millón
    // contra una cuenta cuya contraseña no se conoce.
    await expect(
      authService.completeTwoFactorLogin(
        "challenge-inventado",
        { totpCode: await generateTotpCode(secret) },
        CONTEXTO,
      ),
    ).rejects.toThrow();
  });

  it("rechaza un código equivocado aun con challenge válido", async () => {
    const { user } = await usuarioCon2FA();

    const paso1 = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (paso1.status !== "two_factor_required") throw new Error("esperaba 2FA");

    await expect(
      authService.completeTwoFactorLogin(
        paso1.challengeToken,
        { totpCode: "000000" },
        CONTEXTO,
      ),
    ).rejects.toThrow();
  });

  it("un código ya usado no sirve una segunda vez", async () => {
    const { user, secret } = await usuarioCon2FA();
    const codigo = await generateTotpCode(secret, SIGUIENTE_PERIODO);

    const primero = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (primero.status !== "two_factor_required") throw new Error("esperaba 2FA");
    await authService.completeTwoFactorLogin(
      primero.challengeToken,
      { totpCode: codigo },
      CONTEXTO,
    );

    // Mismo código, segundo intento: si alguien vio la pantalla tiene 30 s de
    // margen, y esto se los quita.
    const segundo = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (segundo.status !== "two_factor_required") throw new Error("esperaba 2FA");

    await expect(
      authService.completeTwoFactorLogin(
        segundo.challengeToken,
        { totpCode: codigo },
        CONTEXTO,
      ),
    ).rejects.toThrow();
  });
});

describe("códigos de respaldo", () => {
  it("permiten entrar si perdiste el teléfono", async () => {
    const { user, codigosDeRespaldo } = await usuarioCon2FA();

    const paso1 = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (paso1.status !== "two_factor_required") throw new Error("esperaba 2FA");

    const paso2 = await authService.completeTwoFactorLogin(
      paso1.challengeToken,
      { backupCode: codigosDeRespaldo[0] },
      CONTEXTO,
    );

    expect(paso2.tokens.accessToken).toBeTruthy();
  });

  it("cada código sirve una sola vez", async () => {
    const { user, codigosDeRespaldo } = await usuarioCon2FA();
    const codigo = codigosDeRespaldo[0];

    const usar = async (): Promise<void> => {
      const paso1 = await authService.login(
        { email: user.email, password: CONTRASENA },
        CONTEXTO,
        mailer,
      );
      if (paso1.status !== "two_factor_required") throw new Error("esperaba 2FA");
      await authService.completeTwoFactorLogin(
        paso1.challengeToken,
        { backupCode: codigo },
        CONTEXTO,
      );
    };

    await usar();
    await expect(usar()).rejects.toThrow();

    expect(await twoFactor.countUnusedBackupCodes(user.id)).toBe(9);
  });

  it("acepta el código con guion o sin él", async () => {
    const { user, codigosDeRespaldo } = await usuarioCon2FA();
    const sinGuion = (codigosDeRespaldo[1] ?? "").replace("-", "");

    const paso1 = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (paso1.status !== "two_factor_required") throw new Error("esperaba 2FA");

    const paso2 = await authService.completeTwoFactorLogin(
      paso1.challengeToken,
      { backupCode: sinGuion },
      CONTEXTO,
    );
    expect(paso2.tokens.accessToken).toBeTruthy();
  });

  it("regenerarlos exige la contraseña e invalida los anteriores", async () => {
    const { user, codigosDeRespaldo } = await usuarioCon2FA();

    await expect(
      twoFactor.regenerateWithPassword(user, "contraseña equivocada"),
    ).rejects.toThrow();

    const nuevos = await twoFactor.regenerateWithPassword(user, CONTRASENA);
    expect(nuevos).toHaveLength(10);
    expect(nuevos).not.toEqual(codigosDeRespaldo);

    // Los viejos dejan de servir.
    const paso1 = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    if (paso1.status !== "two_factor_required") throw new Error("esperaba 2FA");

    await expect(
      authService.completeTwoFactorLogin(
        paso1.challengeToken,
        { backupCode: codigosDeRespaldo[0] },
        CONTEXTO,
      ),
    ).rejects.toThrow();
  });
});

describe("desactivación", () => {
  it("exige la contraseña actual", async () => {
    const { user } = await usuarioCon2FA();

    // Sin esto, alguien que encontrara un portátil sin bloquear podría quitar
    // el segundo factor sin conocer la contraseña.
    await expect(twoFactor.disable(user, "contraseña equivocada")).rejects.toThrow();

    const sigue = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
    expect(sigue.twoFactorEnabledAt).not.toBeNull();
  });

  it("borra el secreto y los códigos de respaldo", async () => {
    const { user } = await usuarioCon2FA();

    await twoFactor.disable(user, CONTRASENA);

    const desactivado = await prisma.user.findFirstOrThrow({ where: { id: user.id } });
    expect(desactivado.twoFactorEnabledAt).toBeNull();
    expect(desactivado.twoFactorSecret).toBeNull();
    expect(await twoFactor.countUnusedBackupCodes(user.id)).toBe(0);

    // Y el login vuelve a ser de un solo factor.
    const resultado = await authService.login(
      { email: user.email, password: CONTRASENA },
      CONTEXTO,
      mailer,
    );
    expect(resultado.status).toBe("authenticated");
  });
});
