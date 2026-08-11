/**
 * Segundo factor: activación, verificación y códigos de respaldo.
 *
 * Flujo de activación en dos pasos, y el segundo NO es opcional:
 *
 *   1. setup()    genera un secreto y devuelve el QR. El 2FA todavía NO está
 *                 activo.
 *   2. confirm()  el usuario teclea un código de su app. Solo entonces se
 *                 activa.
 *
 * Sin el paso 2, alguien podría activar el 2FA sin haber escaneado bien el QR
 * y quedarse fuera de su propia cuenta para siempre. El código correcto es la
 * prueba de que la app quedó bien configurada.
 *
 * Control de seguridad nº 4 de docs/03-seguridad.md.
 */

import type { User } from "@bodegon/db";
import { prisma } from "@bodegon/db";
import { ConflictError, UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { decryptSecret, encryptSecret } from "../../lib/crypto.js";
import { verifyPassword } from "../../lib/password.js";
import { generateBackupCode, hashToken, normalizeBackupCode } from "../../lib/tokens.js";
import {
  buildOtpAuthUrl,
  buildQrDataUrl,
  generateTotpSecret,
  verifyTotp,
} from "../../lib/totp.js";
import * as authRepository from "./auth.repository.js";

/** Cuántos códigos de respaldo se entregan al activar el 2FA. */
const BACKUP_CODE_COUNT = 10;

const CODIGO_INVALIDO = "El código no es válido";

export interface TwoFactorSetup {
  /** Imagen QR lista para mostrar en un <img src="...">. */
  qrDataUrl: string;
  /** El mismo secreto en texto, por si el usuario no puede escanear. */
  manualEntryKey: string;
}

// ─── Activación ──────────────────────────────────────────────────────────────

/**
 * Paso 1: genera el secreto y devuelve el QR.
 *
 * El secreto se guarda ya cifrado, pero `twoFactorEnabledAt` sigue en null: el
 * 2FA aún no protege nada. Solo se activa al confirmar con un código real.
 */
export async function setup(user: User): Promise<TwoFactorSetup> {
  if (user.twoFactorEnabledAt !== null) {
    throw new ConflictError("El segundo factor ya está activo en esta cuenta");
  }

  const secret = generateTotpSecret();

  // Se cifra, no se hashea: el servidor NECESITA leerlo para calcular el
  // código de 6 dígitos, y un hash es irreversible.
  await authRepository.updateUser(user.id, {
    twoFactorSecret: encryptSecret(secret),
    twoFactorLastPeriod: null,
  });

  const otpauthUrl = buildOtpAuthUrl(user.email, secret);

  return {
    qrDataUrl: await buildQrDataUrl(otpauthUrl),
    manualEntryKey: secret,
  };
}

/**
 * Paso 2: confirma con un código real y activa el 2FA.
 *
 * Devuelve los códigos de respaldo, que se muestran UNA SOLA VEZ: se guardan
 * hasheados, así que ni nosotros podemos recuperarlos después.
 */
export async function confirm(user: User, code: string): Promise<string[]> {
  if (user.twoFactorEnabledAt !== null) {
    throw new ConflictError("El segundo factor ya está activo en esta cuenta");
  }
  if (user.twoFactorSecret === null) {
    throw new ConflictError("Primero solicita el código QR");
  }

  const secret = decryptSecret(user.twoFactorSecret);
  const resultado = await verifyTotp(code, secret, null);
  if (!resultado.valid) {
    throw new ValidationError(CODIGO_INVALIDO);
  }

  const codes = await regenerarCodigosDeRespaldo(user.id);

  await authRepository.updateUser(user.id, {
    twoFactorEnabledAt: new Date(),
    // El código usado para confirmar queda consumido: no sirve para el primer
    // login.
    twoFactorLastPeriod: resultado.timeStep,
  });

  return codes;
}

/**
 * Desactiva el 2FA. Exige la contraseña actual.
 *
 * Sin esa comprobación, alguien que encontrara una sesión abierta —un portátil
 * sin bloquear— podría quitar el segundo factor sin conocer la contraseña, y
 * la protección se volvería decorativa.
 */
export async function disable(user: User, password: string): Promise<void> {
  if (user.twoFactorEnabledAt === null) {
    throw new ConflictError("El segundo factor no está activo");
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new UnauthorizedError("La contraseña no es correcta");
  }

  await prisma.backupCode.deleteMany({ where: { userId: user.id } });
  await authRepository.updateUser(user.id, {
    twoFactorSecret: null,
    twoFactorEnabledAt: null,
    twoFactorLastPeriod: null,
  });
}

// ─── Verificación en el login ────────────────────────────────────────────────

/**
 * Comprueba el segundo factor: acepta un código TOTP o uno de respaldo.
 *
 * Impide reusar un código TOTP comparando el periodo: si alguien te ve la
 * pantalla o intercepta el número, tiene 30 s de margen. Guardando el último
 * periodo consumido, el código muere en el instante en que lo usas tú.
 */
export async function verifySecondFactor(
  user: User,
  input: { totpCode?: string | undefined; backupCode?: string | undefined },
): Promise<void> {
  if (user.twoFactorSecret === null) {
    throw new ConflictError("Esta cuenta no tiene segundo factor configurado");
  }

  if (input.totpCode !== undefined) {
    await verificarTotp(user, input.totpCode);
    return;
  }

  if (input.backupCode !== undefined) {
    await consumirCodigoDeRespaldo(user, input.backupCode);
    return;
  }

  throw new ValidationError("Falta el código de verificación");
}

async function verificarTotp(user: User, code: string): Promise<void> {
  const secret = decryptSecret(user.twoFactorSecret ?? "");

  // afterTimeStep rechaza cualquier código de un periodo ya consumido: es la
  // protección contra reuso, y la aplica la propia librería.
  const resultado = await verifyTotp(code, secret, user.twoFactorLastPeriod);

  if (!resultado.valid) {
    throw new UnauthorizedError(CODIGO_INVALIDO);
  }

  // Se anota el periodo consumido para que ese código no vuelva a servir.
  await authRepository.updateUser(user.id, {
    twoFactorLastPeriod: resultado.timeStep,
  });
}

async function consumirCodigoDeRespaldo(user: User, code: string): Promise<void> {
  const normalizado = normalizeBackupCode(code);
  const codigos = await prisma.backupCode.findMany({
    where: { userId: user.id, usedAt: null },
  });

  // Se comparan huellas, no los códigos: están guardados hasheados.
  const objetivo = hashToken(normalizado);
  const encontrado = codigos.find((fila) => fila.codeHash === objetivo);

  if (encontrado === undefined) {
    throw new UnauthorizedError(CODIGO_INVALIDO);
  }

  await prisma.backupCode.update({
    where: { id: encontrado.id },
    data: { usedAt: new Date() },
  });
}

// ─── Códigos de respaldo ─────────────────────────────────────────────────────

/**
 * Genera diez códigos nuevos y descarta los anteriores.
 *
 * Sin ellos, perder el teléfono significaría perder la cuenta para siempre. Se
 * devuelven en claro UNA sola vez —el usuario debe guardarlos— y en la base
 * quedan hasheados: ni nosotros podemos recuperarlos.
 */
export async function regenerarCodigosDeRespaldo(userId: string): Promise<string[]> {
  await prisma.backupCode.deleteMany({ where: { userId } });

  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateBackupCode());

  await prisma.backupCode.createMany({
    data: codes.map((code) => ({
      userId,
      codeHash: hashToken(normalizeBackupCode(code)),
    })),
  });

  return codes;
}

/** Cuántos códigos de respaldo le quedan sin usar. */
export function countUnusedBackupCodes(userId: string): Promise<number> {
  return prisma.backupCode.count({ where: { userId, usedAt: null } });
}

/** Los códigos se regeneran solo tras confirmar la contraseña. */
export async function regenerateWithPassword(
  user: User,
  password: string,
): Promise<string[]> {
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new UnauthorizedError("La contraseña no es correcta");
  }
  return regenerarCodigosDeRespaldo(user.id);
}
