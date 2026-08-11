/**
 * Acceso a datos de autenticación. La única capa que habla con Prisma.
 */

import type { Prisma, User, VerificationTokenType } from "@bodegon/db";
import { prisma } from "@bodegon/db";

/** Busca por email. citext hace la comparación insensible a mayúsculas. */
export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { email, deletedAt: null } });
}

export function findUserById(id: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { id, deletedAt: null } });
}

export function createUser(data: { email: string; passwordHash: string }): Promise<User> {
  return prisma.user.create({ data });
}

export function updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

// ─── Intentos fallidos y bloqueo ─────────────────────────────────────────────

export function incrementFailedAttempts(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { failedLoginAttempts: { increment: 1 } },
  });
}

export function lockAccount(id: string, until: Date): Promise<User> {
  return prisma.user.update({ where: { id }, data: { lockedUntil: until } });
}

/** Tras un login correcto: contador a cero y bloqueo levantado. */
export function clearFailedAttempts(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

// ─── Tokens de verificación y reseteo ────────────────────────────────────────

export function createVerificationToken(data: {
  userId: string;
  tokenHash: string;
  type: VerificationTokenType;
  expiresAt: Date;
}): Promise<{ id: string }> {
  return prisma.verificationToken.create({ data, select: { id: true } });
}

/**
 * Los tipos se anotan explícitamente porque el inferido referencia módulos
 * internos del runtime de Prisma y TypeScript no lo puede nombrar de forma
 * portable.
 */
export type VerificationTokenWithUser = Prisma.VerificationTokenGetPayload<{
  include: { user: true };
}>;

export type RefreshTokenWithUser = Prisma.RefreshTokenGetPayload<{
  include: { user: true };
}>;

export function findVerificationToken(
  tokenHash: string,
  type: VerificationTokenType,
): Promise<VerificationTokenWithUser | null> {
  return prisma.verificationToken.findFirst({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}

export function markVerificationTokenUsed(id: string): Promise<{ id: string }> {
  return prisma.verificationToken.update({
    where: { id },
    data: { usedAt: new Date() },
    select: { id: true },
  });
}

/**
 * Invalida los tokens pendientes de un tipo para un usuario.
 *
 * Se usa al emitir uno nuevo: si pides tres veces "olvidé mi contraseña", solo
 * el último enlace debe funcionar. Los anteriores podrían estar en un buzón
 * comprometido.
 */
export function invalidatePendingTokens(
  userId: string,
  type: VerificationTokenType,
): Promise<{ count: number }> {
  return prisma.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
}

// ─── Sesiones (refresh tokens) ───────────────────────────────────────────────

export function createRefreshToken(data: {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  ip?: string | undefined;
  userAgent?: string | undefined;
}): Promise<{ id: string }> {
  return prisma.refreshToken.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      expiresAt: data.expiresAt,
      // La columna es nullable, así que "no lo sé" se guarda como null.
      // exactOptionalPropertyTypes distingue undefined de ausente, y Prisma
      // espera null: lo convertimos aquí en vez de dejar que se cuele.
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
    },
    select: { id: true },
  });
}

export function findRefreshTokenByHash(
  tokenHash: string,
): Promise<RefreshTokenWithUser | null> {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export function revokeRefreshToken(
  id: string,
  replacedById?: string,
): Promise<{ id: string }> {
  return prisma.refreshToken.update({
    where: { id },
    data: {
      revokedAt: new Date(),
      ...(replacedById === undefined ? {} : { replacedById }),
    },
    select: { id: true },
  });
}

/**
 * Revoca TODA una familia de tokens.
 *
 * Es la respuesta a la detección de reuso (bloque D): si aparece un token ya
 * rotado, alguien lo robó, así que se cierra la cadena entera de sesiones.
 */
export function revokeTokenFamily(familyId: string): Promise<{ count: number }> {
  return prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Cierra todas las sesiones del usuario (cambio de contraseña, logout global). */
export function revokeAllUserTokens(userId: string): Promise<{ count: number }> {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
