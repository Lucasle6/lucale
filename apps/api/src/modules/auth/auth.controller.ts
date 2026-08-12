/**
 * Traduce HTTP ↔ negocio para autenticación.
 *
 * Además de llamar al service, es el único sitio que toca cookies: los tokens
 * se entregan como cookies httpOnly y NUNCA en el cuerpo de la respuesta, para
 * que un XSS no pueda leerlos con JavaScript.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { currentUser } from "../../plugins/authenticate.js";
import { UnauthorizedError } from "../../lib/errors.js";
import {
  COOKIE_NAMES,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from "../../lib/jwt.js";
import type { Mailer } from "../../lib/mailer.js";
import * as authService from "./auth.service.js";
import type { SessionTokens } from "./auth.service.js";
import type {
  LoginInput,
  RegisterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "./auth.schemas.js";
import * as twoFactorService from "./two-factor.service.js";

/** Respuesta genérica de las operaciones que no deben revelar si algo existe. */
const ACEPTADO = {
  message: "Si el correo corresponde a una cuenta, recibirás un mensaje en breve.",
};

function contextoDe(request: FastifyRequest): authService.RequestContext {
  return { ip: request.ip, userAgent: request.headers["user-agent"] };
}

/** Deja los tokens en cookies httpOnly; nunca viajan en el cuerpo. */
function ponerCookies(reply: FastifyReply, tokens: SessionTokens): void {
  reply.setCookie(COOKIE_NAMES.accessToken, tokens.accessToken, accessCookieOptions());
  reply.setCookie(COOKIE_NAMES.refreshToken, tokens.refreshToken, refreshCookieOptions());
}

function limpiarCookies(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAMES.accessToken, clearCookieOptions());
  reply.clearCookie(COOKIE_NAMES.refreshToken, clearCookieOptions());
}

function leerRefreshToken(request: FastifyRequest): string {
  const cookie = request.cookies[COOKIE_NAMES.refreshToken];
  if (cookie === undefined) {
    throw new UnauthorizedError("No hay sesión que renovar");
  }
  const unsigned = request.unsignCookie(cookie);
  if (!unsigned.valid || unsigned.value === null) {
    throw new UnauthorizedError("Tu sesión no es válida. Inicia sesión de nuevo.");
  }
  return unsigned.value;
}

// ─── Cuenta ──────────────────────────────────────────────────────────────────

export function register(mailer: Mailer) {
  return async function handler(
    request: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    await authService.register(request.body, mailer);
    // 202 y mensaje genérico: exista o no el correo, la respuesta es idéntica.
    await reply.status(202).send(ACEPTADO);
  };
}

export async function verifyEmail(
  request: FastifyRequest<{ Body: VerifyEmailInput }>,
  reply: FastifyReply,
): Promise<void> {
  await authService.verifyEmail(request.body.token);
  await reply.send({ message: "Correo verificado correctamente" });
}

// ─── Sesión ──────────────────────────────────────────────────────────────────

export function login(mailer: Mailer) {
  return async function handler(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const resultado = await authService.login(request.body, contextoDe(request), mailer);

    if (resultado.status === "two_factor_required") {
      await reply.send({
        status: "two_factor_required",
        challengeToken: resultado.challengeToken,
      });
      return;
    }

    ponerCookies(reply, resultado.tokens);
    await reply.send({
      status: "authenticated",
      user: authService.toProfile(resultado.user),
    });
  };
}

export async function completeTwoFactor(
  request: FastifyRequest<{
    Body: { challengeToken: string; totpCode?: string; backupCode?: string };
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { challengeToken, totpCode, backupCode } = request.body;

  const resultado = await authService.completeTwoFactorLogin(
    challengeToken,
    { totpCode, backupCode },
    contextoDe(request),
  );

  ponerCookies(reply, resultado.tokens);
  await reply.send({
    status: "authenticated",
    user: authService.toProfile(resultado.user),
  });
}

export function refresh(mailer: Mailer) {
  return async function handler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const tokens = await authService.refreshSession(
      leerRefreshToken(request),
      contextoDe(request),
      mailer,
    );

    ponerCookies(reply, tokens);
    await reply.send({ message: "Sesión renovada" });
  };
}

export async function logout(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const cookie = request.cookies[COOKIE_NAMES.refreshToken];
  if (cookie !== undefined) {
    const unsigned = request.unsignCookie(cookie);
    if (unsigned.valid && unsigned.value !== null) {
      await authService.logout(unsigned.value);
    }
  }

  // Las cookies se borran pase lo que pase: cerrar sesión nunca debe fallar.
  limpiarCookies(reply);
  await reply.send({ message: "Sesión cerrada" });
}

export async function logoutAll(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authService.logoutAll(currentUser(request).id);
  limpiarCookies(reply);
  await reply.send({ message: "Se cerraron todas tus sesiones" });
}

export async function me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await reply.send(authService.toProfile(currentUser(request)));
}

// ─── Contraseña ──────────────────────────────────────────────────────────────

export function requestPasswordReset(mailer: Mailer) {
  return async function handler(
    request: FastifyRequest<{ Body: RequestPasswordResetInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    await authService.requestPasswordReset(request.body.email, mailer);
    // Siempre 202 con el mismo texto: si distinguiéramos, este endpoint sería
    // un buscador de clientes.
    await reply.status(202).send(ACEPTADO);
  };
}

export async function resetPassword(
  request: FastifyRequest<{ Body: ResetPasswordInput }>,
  reply: FastifyReply,
): Promise<void> {
  await authService.resetPassword(request.body.token, request.body.password);
  limpiarCookies(reply);
  await reply.send({
    message: "Contraseña actualizada. Se cerraron todas las sesiones anteriores.",
  });
}

export async function changePassword(
  request: FastifyRequest<{ Body: { currentPassword: string; newPassword: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await authService.changePassword(
    currentUser(request),
    request.body.currentPassword,
    request.body.newPassword,
  );
  limpiarCookies(reply);
  await reply.send({
    message: "Contraseña actualizada. Vuelve a iniciar sesión.",
  });
}

// ─── Segundo factor ──────────────────────────────────────────────────────────

export async function setupTwoFactor(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const setup = await twoFactorService.setup(currentUser(request));
  await reply.send(setup);
}

export async function confirmTwoFactor(
  request: FastifyRequest<{ Body: { totpCode: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const codes = await twoFactorService.confirm(
    currentUser(request),
    request.body.totpCode,
  );
  // Los códigos se muestran UNA sola vez: en la base quedan hasheados.
  await reply.send({
    backupCodes: codes,
    message: "Guarda estos códigos ahora: no volverán a mostrarse.",
  });
}

export async function disableTwoFactor(
  request: FastifyRequest<{ Body: { password: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await twoFactorService.disable(currentUser(request), request.body.password);
  await reply.send({ message: "Segundo factor desactivado" });
}

export async function regenerateBackupCodes(
  request: FastifyRequest<{ Body: { password: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const codes = await twoFactorService.regenerateWithPassword(
    currentUser(request),
    request.body.password,
  );
  await reply.send({
    backupCodes: codes,
    message: "Guarda estos códigos ahora: los anteriores dejaron de servir.",
  });
}
