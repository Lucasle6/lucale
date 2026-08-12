/**
 * Traduce HTTP ↔ negocio para el panel de administración.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { auditContext } from "../../lib/audit.js";
import { AUDIT_ACTIONS, recordAudit } from "../../lib/audit.js";
import {
  COOKIE_NAMES,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from "../../lib/jwt.js";
import type { Mailer } from "../../lib/mailer.js";
import { currentUser } from "../../plugins/authenticate.js";
import * as authService from "../auth/auth.service.js";
import type { SessionTokens } from "../auth/auth.service.js";
import * as adminAuthService from "./admin-auth.service.js";
import type { AuditableContext } from "./admin-auth.service.js";

function contexto(request: FastifyRequest): AuditableContext {
  return { ...auditContext(request), log: request.log };
}

function ponerCookies(reply: FastifyReply, tokens: SessionTokens): void {
  reply.setCookie(COOKIE_NAMES.accessToken, tokens.accessToken, accessCookieOptions());
  reply.setCookie(COOKIE_NAMES.refreshToken, tokens.refreshToken, refreshCookieOptions());
}

export function login(mailer: Mailer) {
  return async function handler(
    request: FastifyRequest<{ Body: { email: string; password: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const resultado = await adminAuthService.login(
      request.body,
      contexto(request),
      mailer,
    );
    // Nunca hay sesión en este paso: el panel exige segundo factor siempre.
    await reply.send(resultado);
  };
}

export async function completeLogin(
  request: FastifyRequest<{
    Body: { challengeToken: string; totpCode?: string; backupCode?: string };
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { challengeToken, totpCode, backupCode } = request.body;

  const resultado = await adminAuthService.completeLogin(
    challengeToken,
    { totpCode, backupCode },
    contexto(request),
  );

  ponerCookies(reply, resultado.tokens);
  await reply.send({
    status: "authenticated",
    user: authService.toProfile(resultado.user),
  });
}

export async function setupTwoFactor(
  request: FastifyRequest<{ Body: { challengeToken: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const setup = await adminAuthService.setupTwoFactorDuringLogin(
    request.body.challengeToken,
  );
  await reply.send(setup);
}

export async function confirmTwoFactor(
  request: FastifyRequest<{ Body: { challengeToken: string; totpCode: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const resultado = await adminAuthService.confirmTwoFactorDuringLogin(
    request.body.challengeToken,
    request.body.totpCode,
    contexto(request),
  );

  ponerCookies(reply, resultado.tokens);
  await reply.send({
    status: "authenticated",
    user: authService.toProfile(resultado.user),
    backupCodes: resultado.backupCodes,
    message: "Guarda estos códigos ahora: no volverán a mostrarse.",
  });
}

export async function logout(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = currentUser(request);

  const cookie = request.cookies[COOKIE_NAMES.refreshToken];
  if (cookie !== undefined) {
    const unsigned = request.unsignCookie(cookie);
    if (unsigned.valid && unsigned.value !== null) {
      await authService.logout(unsigned.value);
    }
  }

  await recordAudit(
    {
      actorId: user.id,
      action: AUDIT_ACTIONS.adminLogout,
      entityType: "User",
      entityId: user.id,
      ...auditContext(request),
    },
    request.log,
  );

  reply.clearCookie(COOKIE_NAMES.accessToken, clearCookieOptions());
  reply.clearCookie(COOKIE_NAMES.refreshToken, clearCookieOptions());
  await reply.send({ message: "Sesión cerrada" });
}

export async function me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await reply.send(authService.toProfile(currentUser(request)));
}
