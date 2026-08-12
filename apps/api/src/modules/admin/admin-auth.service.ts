/**
 * Autenticación de administradores.
 *
 * Reutiliza toda la maquinaria del Día 4 (argon2, rotación con detección de
 * reuso, TOTP) y añade tres diferencias respecto a la de clientes:
 *
 *   1. Los tokens llevan audiencia "admin", así que un token de cliente falla
 *      criptográficamente en cualquier ruta del panel.
 *   2. El segundo factor es OBLIGATORIO, no opcional.
 *   3. Cada intento, acertado o fallido, queda en el registro de auditoría.
 *
 * Controles de seguridad nº 4, 8, 15 y 17 de docs/03-seguridad.md.
 */

import { UserRole } from "@bodegon/db";
import type { User } from "@bodegon/db";
import type { FastifyBaseLogger } from "fastify";
import { AUDIT_ACTIONS, recordAudit } from "../../lib/audit.js";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import {
  TOKEN_AUDIENCE,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from "../../lib/jwt.js";
import type { Mailer } from "../../lib/mailer.js";
import * as authRepository from "../auth/auth.repository.js";
import * as authService from "../auth/auth.service.js";
import type { RequestContext, SessionTokens } from "../auth/auth.service.js";
import * as twoFactorService from "../auth/two-factor.service.js";

/** Mismo mensaje para todos los fallos, igual que en el login de clientes. */
const CREDENCIALES_INVALIDAS = "Credenciales incorrectas";

export type AdminLoginResult =
  | { status: "two_factor_required"; challengeToken: string }
  | { status: "two_factor_setup_required"; challengeToken: string };

export interface AuditableContext extends RequestContext {
  log: FastifyBaseLogger;
}

/**
 * Primer paso del login de admin.
 *
 * NUNCA devuelve una sesión directamente, ni siquiera con la contraseña
 * correcta: el panel exige segundo factor sin excepciones. Si el admin todavía
 * no lo tiene configurado, se le obliga a hacerlo ahora.
 */
export async function login(
  input: { email: string; password: string },
  context: AuditableContext,
  mailer: Mailer,
): Promise<AdminLoginResult> {
  // Se delega en el login de clientes para no duplicar las defensas: mismo
  // orden de comprobaciones, mismo señuelo de timing, mismo bloqueo.
  let resultado: authService.LoginResult;
  try {
    resultado = await authService.login(input, context, mailer);
  } catch {
    await registrarIntentoFallido(input.email, context);
    // Se re-lanza con el mensaje del panel, sin distinguir el motivo.
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }

  // A partir de aquí la contraseña fue correcta. Falta comprobar que quien
  // entra puede estar en el panel.
  const user = await authRepository.findUserByEmail(input.email);

  if (user === null || user.role === UserRole.CUSTOMER) {
    // Un cliente con credenciales válidas intentando entrar al panel es una
    // señal, no un descuido: queda registrado.
    await recordAudit(
      {
        actorId: user?.id ?? null,
        action: AUDIT_ACTIONS.unauthorizedAccess,
        entityType: "AdminPanel",
        metadata: { motivo: "rol insuficiente", rol: user?.role ?? "desconocido" },
        ip: context.ip,
        userAgent: context.userAgent,
      },
      context.log,
    );
    // Mismo mensaje que una contraseña equivocada: no confirmamos que la
    // cuenta exista ni que la contraseña fuera correcta.
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }

  // El 2FA es obligatorio. Si el admin aún no lo configuró, no se le deja
  // pasar: se le manda a activarlo con un challenge que prueba que ya acertó
  // la contraseña.
  if (resultado.status !== "two_factor_required") {
    return {
      status: "two_factor_setup_required",
      challengeToken: await signTwoFactorChallenge(user.id),
    };
  }

  return { status: "two_factor_required", challengeToken: resultado.challengeToken };
}

/**
 * Segundo paso: verifica el código y entrega la sesión de ADMIN.
 *
 * La audiencia "admin" es lo que hace que este token no sirva en las rutas de
 * cliente y viceversa.
 */
export async function completeLogin(
  challengeToken: string,
  codes: { totpCode?: string | undefined; backupCode?: string | undefined },
  context: AuditableContext,
): Promise<{ user: User; tokens: SessionTokens }> {
  const user = await usuarioDelChallenge(challengeToken);

  if (user.role === UserRole.CUSTOMER) {
    throw new ForbiddenError("No tienes permiso para acceder al panel");
  }
  if (user.twoFactorEnabledAt === null) {
    throw new ForbiddenError("Debes activar el segundo factor antes de entrar");
  }

  await twoFactorService.verifySecondFactor(user, codes);

  const tokens = await authService.createSession(user, context, TOKEN_AUDIENCE.admin);

  await recordAudit(
    {
      actorId: user.id,
      action: AUDIT_ACTIONS.adminLoginSuccess,
      entityType: "User",
      entityId: user.id,
      metadata: {
        metodo: codes.backupCode === undefined ? "totp" : "código de respaldo",
      },
      ip: context.ip,
      userAgent: context.userAgent,
    },
    context.log,
  );

  return { user, tokens };
}

/**
 * Activa el 2FA durante el login, para un admin que aún no lo tenía.
 *
 * Solo accesible con un challenge válido: hay que haber acertado la contraseña
 * primero.
 */
export async function setupTwoFactorDuringLogin(
  challengeToken: string,
): Promise<{ qrDataUrl: string; manualEntryKey: string }> {
  const user = await usuarioDelChallenge(challengeToken);

  if (user.role === UserRole.CUSTOMER) {
    throw new ForbiddenError("No tienes permiso para acceder al panel");
  }

  return twoFactorService.setup(user);
}

/** Confirma la activación durante el login y entrega la sesión y los códigos. */
export async function confirmTwoFactorDuringLogin(
  challengeToken: string,
  totpCode: string,
  context: AuditableContext,
): Promise<{ user: User; tokens: SessionTokens; backupCodes: string[] }> {
  const user = await usuarioDelChallenge(challengeToken);

  if (user.role === UserRole.CUSTOMER) {
    throw new ForbiddenError("No tienes permiso para acceder al panel");
  }

  const backupCodes = await twoFactorService.confirm(user, totpCode);
  const actualizado = await authRepository.findUserById(user.id);
  if (actualizado === null) {
    throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
  }

  const tokens = await authService.createSession(
    actualizado,
    context,
    TOKEN_AUDIENCE.admin,
  );

  await recordAudit(
    {
      actorId: user.id,
      action: AUDIT_ACTIONS.adminTwoFactorEnabled,
      entityType: "User",
      entityId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
    },
    context.log,
  );

  return { user: actualizado, tokens, backupCodes };
}

async function usuarioDelChallenge(challengeToken: string): Promise<User> {
  let userId: string;
  try {
    userId = await verifyTwoFactorChallenge(challengeToken);
  } catch {
    throw new UnauthorizedError("La verificación caducó. Inicia sesión de nuevo.");
  }

  const user = await authRepository.findUserById(userId);
  if (user === null) {
    throw new UnauthorizedError("La verificación caducó. Inicia sesión de nuevo.");
  }
  return user;
}

async function registrarIntentoFallido(
  email: string,
  context: AuditableContext,
): Promise<void> {
  const user = await authRepository.findUserByEmail(email);
  await recordAudit(
    {
      actorId: user?.id ?? null,
      action: AUDIT_ACTIONS.adminLoginFailed,
      entityType: "AdminPanel",
      // El correo se registra porque es la única forma de investigar un ataque
      // dirigido. Nunca la contraseña.
      metadata: { email },
      ip: context.ip,
      userAgent: context.userAgent,
    },
    context.log,
  );
}
