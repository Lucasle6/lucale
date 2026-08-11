/**
 * Reglas de negocio de autenticación.
 *
 * No sabe qué es HTTP ni qué es Prisma: recibe datos, lanza errores de negocio
 * y pide al repository. Por eso se puede razonar sobre la seguridad leyendo
 * solo este archivo.
 *
 * Controles implementados aquí (docs/03-seguridad.md):
 *   nº 1  hashing argon2id            nº 5  sin enumeración de usuarios
 *   nº 2  tokens de acceso cortos     nº 6  bloqueo progresivo
 *   nº 3  refresh rotativo
 */

import { randomUUID } from "node:crypto";
import type { User } from "@bodegon/db";
import { VerificationTokenType } from "@bodegon/db";
import { env } from "../../config/env.js";
import { ConflictError, UnauthorizedError } from "../../lib/errors.js";
import {
  TOKEN_AUDIENCE,
  signAccessToken,
  signTwoFactorChallenge,
} from "../../lib/jwt.js";
import type { Mailer } from "../../lib/mailer.js";
import {
  hashPassword,
  needsRehash,
  verifyPassword,
  fakeVerify,
} from "../../lib/password.js";
import {
  expiresInDays,
  expiresInMinutes,
  generateToken,
  hashToken,
} from "../../lib/tokens.js";
import * as authRepository from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

/**
 * Mensaje único para TODOS los fallos de login: email inexistente, contraseña
 * incorrecta, cuenta bloqueada. Si variara, revelaría cuáles de esos casos se
 * cumplen — y con eso se construye la lista de clientes de la tienda.
 */
const CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos";

/**
 * Mensaje único para todos los fallos de sesión: token inexistente, caducado,
 * revocado o reusado. Nunca decimos "detectamos un reuso" — eso le confirmaría
 * al atacante que el token era auténtico y que fuimos nosotros quienes cerramos
 * la sesión. Al dueño real se le explica por correo.
 */
const SESION_INVALIDA = "Tu sesión no es válida. Inicia sesión de nuevo.";

/** Intentos fallidos antes de bloquear. */
const MAX_FAILED_ATTEMPTS = 5;

/** Contexto de la petición, para auditoría de sesiones. */
export interface RequestContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Id de la fila creada, para trazar la cadena de rotaciones. */
  refreshTokenId: string;
}

// ─── Registro ────────────────────────────────────────────────────────────────

/**
 * Crea una cuenta.
 *
 * Responde EXACTAMENTE lo mismo exista o no el correo. Si ya existía, se avisa
 * al dueño real por email: él se entera por un canal que solo controla él, y
 * quien hizo la petición no aprende nada.
 */
export async function register(input: RegisterInput, mailer: Mailer): Promise<void> {
  // El hash se calcula ANTES de mirar si el email existe, aunque a veces se
  // tire. Si comprobáramos primero, el camino "ya existe" sería instantáneo y
  // el camino "nuevo" costaría 15 ms: esa diferencia es medible desde fuera.
  const passwordHash = await hashPassword(input.password);

  const existing = await authRepository.findUserByEmail(input.email);

  if (existing !== null) {
    await mailer.sendDuplicateRegistrationNotice(input.email);
    return;
  }

  const user = await authRepository.createUser({
    email: input.email,
    passwordHash,
  });

  await enviarVerificacionDeCorreo(user, mailer);
}

async function enviarVerificacionDeCorreo(user: User, mailer: Mailer): Promise<void> {
  // Solo el último enlace debe servir: los anteriores podrían estar en un
  // buzón comprometido.
  await authRepository.invalidatePendingTokens(
    user.id,
    VerificationTokenType.EMAIL_VERIFY,
  );

  const token = generateToken();
  await authRepository.createVerificationToken({
    userId: user.id,
    tokenHash: hashToken(token),
    type: VerificationTokenType.EMAIL_VERIFY,
    expiresAt: expiresInDays(1),
  });

  await mailer.sendVerificationEmail(user.email, token);
}

// ─── Login ───────────────────────────────────────────────────────────────────

export type LoginResult =
  | { status: "authenticated"; user: User; tokens: SessionTokens }
  | { status: "two_factor_required"; challengeToken: string };

/**
 * Inicia sesión.
 *
 * El orden de las comprobaciones no es casual:
 *
 *   1. ¿existe?      no → quemar tiempo + error genérico
 *   2. ¿bloqueado?   sí → quemar tiempo + error genérico
 *   3. ¿contraseña?  no → contar intento + error genérico
 *   4. sí            → limpiar contador y crear sesión
 *
 * El paso 2 va ANTES de verificar la contraseña a propósito. Si verificáramos
 * primero y respondiéramos "cuenta bloqueada", le estaríamos confirmando al
 * atacante que ACERTÓ la contraseña: le bloqueamos la entrada pero le
 * regalamos el hallazgo, que podría reusar en otro sitio donde la víctima
 * repita esa clave. Comprobando el bloqueo primero, siempre recibe el mismo
 * mensaje y nunca sabe si dio con ella.
 *
 * El costo es de experiencia de usuario, y se compensa avisando al dueño por
 * correo cuando su cuenta se bloquea.
 */
export async function login(
  input: LoginInput,
  context: RequestContext,
  mailer: Mailer,
): Promise<LoginResult> {
  const user = await authRepository.findUserByEmail(input.email);

  if (user === null) {
    // Gasta el mismo cómputo que una verificación real para que ambos caminos
    // tarden igual (control nº 5).
    await fakeVerify();
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }

  if (user.lockedUntil !== null && user.lockedUntil > new Date()) {
    await fakeVerify();
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);

  if (!passwordOk) {
    await registrarIntentoFallido(user, mailer);
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }

  // Login correcto: contador a cero y bloqueo levantado.
  await authRepository.clearFailedAttempts(user.id);

  // Si los parámetros de argon2 subieron desde la última vez, este es el único
  // momento en que tenemos la contraseña en claro para rehashearla. Migración
  // silenciosa, sin pedirle nada al usuario.
  if (needsRehash(user.passwordHash)) {
    await authRepository.updateUser(user.id, {
      passwordHash: await hashPassword(input.password),
    });
  }

  // Segundo factor, si la cuenta lo tiene activo. El challengeToken prueba que
  // la contraseña ya fue correcta; sin él, alguien podría saltarse el primer
  // factor enviando solo un código de 6 dígitos (bloque E).
  if (user.twoFactorEnabledAt !== null) {
    return {
      status: "two_factor_required",
      challengeToken: await signTwoFactorChallenge(user.id),
    };
  }

  return {
    status: "authenticated",
    user,
    tokens: await createSession(user, context),
  };
}

/**
 * Cuenta un intento fallido y bloquea al llegar al límite.
 *
 * El bloqueo es progresivo: cada tanda de fallos por encima del umbral dobla
 * la espera (15 min, 30, 60...) hasta un tope de 24 h. Así un usuario
 * despistado se recupera pronto, pero un ataque sostenido se vuelve inviable.
 */
async function registrarIntentoFallido(user: User, mailer: Mailer): Promise<void> {
  const actualizado = await authRepository.incrementFailedAttempts(user.id);

  if (actualizado.failedLoginAttempts < MAX_FAILED_ATTEMPTS) return;

  const tandas = Math.floor(actualizado.failedLoginAttempts / MAX_FAILED_ATTEMPTS);
  const minutos = Math.min(15 * 2 ** (tandas - 1), 24 * 60);
  const hasta = expiresInMinutes(minutos);

  await authRepository.lockAccount(user.id, hasta);
  // El dueño real se entera por un canal que solo él controla; la respuesta
  // HTTP sigue siendo genérica.
  await mailer.sendAccountLockedNotice(user.email, hasta);
}

// ─── Sesiones ────────────────────────────────────────────────────────────────

/**
 * Crea una sesión nueva: un access token (JWT corto) y un refresh token
 * (opaco, guardado hasheado).
 *
 * `familyId` nuevo por sesión: cada dispositivo tiene su cadena de rotaciones
 * independiente, así que revocar una no cierra las demás. Su papel completo se
 * ve en el bloque D.
 */
export async function createSession(
  user: User,
  context: RequestContext,
): Promise<SessionTokens> {
  return crearTokensDeSesion(user, randomUUID(), context);
}

export async function crearTokensDeSesion(
  user: User,
  familyId: string,
  context: RequestContext,
): Promise<SessionTokens> {
  const refreshToken = generateToken();

  const creado = await authRepository.createRefreshToken({
    userId: user.id,
    // Se guarda la huella, nunca el token: si roban la base, no se llevan
    // sesiones activas.
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: expiresInDays(env.REFRESH_TOKEN_TTL_DAYS),
    ip: context.ip,
    userAgent: context.userAgent,
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    aud: TOKEN_AUDIENCE.customer,
  });

  return { accessToken, refreshToken, refreshTokenId: creado.id };
}

// ─── Rotación con detección de reuso ─────────────────────────────────────────

/**
 * Renueva la sesión rotando el refresh token, y detecta si alguien lo robó.
 *
 * EL PROBLEMA: un refresh token dura 30 días. Si te lo roban, el ladrón tiene
 * tu sesión un mes — y el servidor no puede distinguirlo de ti, porque el
 * token que presenta es correcto.
 *
 * LA IDEA: cada uso rota el token. El viejo muere y nace uno nuevo, ambos de
 * la misma familia. Eso solo no detecta nada... hasta que aparece un ladrón:
 *
 *     tú     usas A  →  recibes B     (A queda muerto)
 *     ladrón usa  A  →  ¡A ya está muerto!
 *
 * Un token ya rotado solo puede llegar de dos sitios: de alguien que lo copió,
 * o de ti si el ladrón se te adelantó. En ambos casos HAY UN INTRUSO. No
 * existe escenario legítimo donde reaparezca un token muerto.
 *
 * LA RESPUESTA: revocar la familia entera. Como no sabemos cuál de los dos es
 * el legítimo, expulsamos a ambos — tú tienes la contraseña para volver, el
 * ladrón no. Y te avisamos por correo, convirtiendo un robo silencioso en una
 * alarma.
 *
 * Control de seguridad nº 3 de docs/03-seguridad.md.
 */
export async function refreshSession(
  refreshToken: string,
  context: RequestContext,
  mailer: Mailer,
): Promise<SessionTokens> {
  const stored = await authRepository.findRefreshTokenByHash(hashToken(refreshToken));

  // Token que nunca emitimos, o de una sesión ya purgada.
  if (stored === null) {
    throw new UnauthorizedError(SESION_INVALIDA);
  }

  // 🚨 REUSO DETECTADO: este token ya había rotado.
  if (stored.revokedAt !== null) {
    await dispararAlarmaDeReuso(stored.familyId, stored.user.email, mailer);
    throw new UnauthorizedError(SESION_INVALIDA);
  }

  if (stored.expiresAt <= new Date()) {
    throw new UnauthorizedError(SESION_INVALIDA);
  }

  // La cuenta pudo borrarse o bloquearse mientras la sesión seguía viva.
  if (stored.user.deletedAt !== null) {
    await authRepository.revokeTokenFamily(stored.familyId);
    throw new UnauthorizedError(SESION_INVALIDA);
  }

  // Comparar-y-escribir atómico: mata el token viejo solo si seguía activo.
  // Si falla, otra petición se nos adelantó entre la lectura y esta línea, y
  // eso es indistinguible de un reuso: se trata como tal.
  const loConseguimos = await authRepository.revokeRefreshTokenIfActive(stored.id);
  if (!loConseguimos) {
    await dispararAlarmaDeReuso(stored.familyId, stored.user.email, mailer);
    throw new UnauthorizedError(SESION_INVALIDA);
  }

  // Token nuevo en la MISMA familia: la cadena continúa.
  const tokens = await crearTokensDeSesion(stored.user, stored.familyId, context);

  // Deja el rastro de qué token sustituyó a cuál.
  await authRepository.linkReplacementToken(stored.id, tokens.refreshTokenId);

  return tokens;
}

async function dispararAlarmaDeReuso(
  familyId: string,
  email: string,
  mailer: Mailer,
): Promise<void> {
  await authRepository.revokeTokenFamily(familyId);
  await mailer.sendSessionRevokedNotice(email);
}

/** Cierra la sesión actual. */
export async function logout(refreshToken: string): Promise<void> {
  const stored = await authRepository.findRefreshTokenByHash(hashToken(refreshToken));
  if (stored !== null && stored.revokedAt === null) {
    await authRepository.revokeRefreshToken(stored.id);
  }
}

/** Cierra todas las sesiones del usuario, en todos sus dispositivos. */
export async function logoutAll(userId: string): Promise<void> {
  await authRepository.revokeAllUserTokens(userId);
}

// ─── Verificación de correo ──────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<void> {
  const stored = await authRepository.findVerificationToken(
    hashToken(token),
    VerificationTokenType.EMAIL_VERIFY,
  );

  if (stored === null) {
    throw new ConflictError("El enlace no es válido o ya caducó");
  }

  await authRepository.markVerificationTokenUsed(stored.id);
  await authRepository.updateUser(stored.userId, { emailVerifiedAt: new Date() });
}

/** Perfil público del usuario: nunca incluye hash ni secretos. */
export function toProfile(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    twoFactorEnabled: user.twoFactorEnabledAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
