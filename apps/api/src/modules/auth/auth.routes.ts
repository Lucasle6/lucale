/**
 * Endpoints de autenticación de clientes.
 *
 * El rate limiting es escalonado: el límite global de 100/min no sirve para el
 * login, donde 100 intentos por minuto serían un regalo para la fuerza bruta.
 * Cada endpoint sensible lleva el suyo.
 *
 * Especial atención al de verificación 2FA: un código TOTP son un millón de
 * combinaciones. Sin límite, quien tuviera la contraseña las probaría todas en
 * minutos y el segundo factor sería decorativo.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "../../config/env.js";
import type { Mailer } from "../../lib/mailer.js";
import { TOKEN_AUDIENCE } from "../../lib/jwt.js";
import { requireAuth } from "../../plugins/authenticate.js";
import * as authController from "./auth.controller.js";
import {
  backupCodesResponseSchema,
  changePasswordSchema,
  completeTwoFactorSchema,
  confirmTwoFactorSchema,
  genericAcceptedSchema,
  loginResponseSchema,
  loginSchema,
  messageResponseSchema,
  passwordConfirmationSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  twoFactorSetupResponseSchema,
  userProfileSchema,
  verifyEmailSchema,
} from "./auth.schemas.js";

/**
 * Bajo Vitest los límites se desactivan: un archivo de tests crea decenas de
 * cuentas y chocaría con el tope de 3 registros/hora, haciendo fallar pruebas
 * que no tienen nada que ver con el rate limiting. Los límites se verifican
 * aparte, contra el servidor real, y en la auditoría del Día 12.
 *
 * `false` desactiva el límite de la ruta; poner `global: false` en el plugin no
 * basta, porque la configuración por ruta se aplica igualmente.
 */
const EN_TESTS = env.VITEST !== undefined;

/** Fuerza bruta contra una contraseña o un código de 6 dígitos. */
const LIMITE_ESTRICTO = EN_TESTS ? false : { max: 5, timeWindow: "15 minutes" };
/** Creación masiva de cuentas y bombardeo de correos a una víctima. */
const LIMITE_CORREO = EN_TESTS ? false : { max: 3, timeWindow: "1 hour" };

export function authRoutes(app: FastifyInstance, mailer: Mailer): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  const auth = requireAuth(TOKEN_AUDIENCE.customer);

  // ─── Cuenta ────────────────────────────────────────────────────────────────

  route.post("/auth/register", {
    schema: {
      tags: ["auth"],
      summary: "Crea una cuenta y envía el correo de verificación",
      body: registerSchema,
      response: { 202: genericAcceptedSchema },
    },
    config: { rateLimit: LIMITE_CORREO },
    handler: authController.register(mailer),
  });

  route.post("/auth/verify-email", {
    schema: {
      tags: ["auth"],
      summary: "Verifica el correo con el token del enlace",
      body: verifyEmailSchema,
      response: { 200: messageResponseSchema },
    },
    config: { rateLimit: LIMITE_ESTRICTO },
    handler: authController.verifyEmail,
  });

  // ─── Sesión ────────────────────────────────────────────────────────────────

  route.post("/auth/login", {
    schema: {
      tags: ["auth"],
      summary: "Inicia sesión; puede requerir un segundo factor",
      body: loginSchema,
      response: { 200: loginResponseSchema },
    },
    // 5 intentos cada 15 minutos: el bloqueo por cuenta protege a un usuario
    // concreto, esto protege contra probar una contraseña común en muchas
    // cuentas distintas (password spraying).
    config: { rateLimit: LIMITE_ESTRICTO },
    handler: authController.login(mailer),
  });

  route.post("/auth/login/2fa", {
    schema: {
      tags: ["auth"],
      summary: "Completa el login con el código del segundo factor",
      body: completeTwoFactorSchema,
      response: { 200: loginResponseSchema },
    },
    config: { rateLimit: LIMITE_ESTRICTO },
    handler: authController.completeTwoFactor,
  });

  route.post("/auth/refresh", {
    schema: {
      tags: ["auth"],
      summary: "Renueva la sesión rotando el refresh token",
      response: { 200: messageResponseSchema },
    },
    handler: authController.refresh(mailer),
  });

  route.post("/auth/logout", {
    schema: {
      tags: ["auth"],
      summary: "Cierra la sesión actual",
      response: { 200: messageResponseSchema },
    },
    handler: authController.logout,
  });

  route.post("/auth/logout-all", {
    schema: {
      tags: ["auth"],
      summary: "Cierra la sesión en todos los dispositivos",
      response: { 200: messageResponseSchema },
    },
    preHandler: auth,
    handler: authController.logoutAll,
  });

  route.get("/auth/me", {
    schema: {
      tags: ["auth"],
      summary: "Perfil del usuario autenticado",
      response: { 200: userProfileSchema },
    },
    preHandler: auth,
    handler: authController.me,
  });

  // ─── Contraseña ────────────────────────────────────────────────────────────

  route.post("/auth/password/forgot", {
    schema: {
      tags: ["auth"],
      summary: "Solicita un enlace para restablecer la contraseña",
      body: requestPasswordResetSchema,
      response: { 202: genericAcceptedSchema },
    },
    config: { rateLimit: LIMITE_CORREO },
    handler: authController.requestPasswordReset(mailer),
  });

  route.post("/auth/password/reset", {
    schema: {
      tags: ["auth"],
      summary: "Cambia la contraseña con el token del enlace",
      body: resetPasswordSchema,
      response: { 200: messageResponseSchema },
    },
    config: { rateLimit: LIMITE_ESTRICTO },
    handler: authController.resetPassword,
  });

  route.post("/auth/password/change", {
    schema: {
      tags: ["auth"],
      summary: "Cambia la contraseña estando dentro",
      body: changePasswordSchema,
      response: { 200: messageResponseSchema },
    },
    preHandler: auth,
    handler: authController.changePassword,
  });

  // ─── Segundo factor ────────────────────────────────────────────────────────

  route.post("/auth/2fa/setup", {
    schema: {
      tags: ["auth"],
      summary: "Genera el QR para activar el segundo factor",
      response: { 200: twoFactorSetupResponseSchema },
    },
    preHandler: auth,
    handler: authController.setupTwoFactor,
  });

  route.post("/auth/2fa/confirm", {
    schema: {
      tags: ["auth"],
      summary: "Confirma con un código y activa el segundo factor",
      body: confirmTwoFactorSchema,
      response: { 200: backupCodesResponseSchema },
    },
    preHandler: auth,
    config: { rateLimit: LIMITE_ESTRICTO },
    handler: authController.confirmTwoFactor,
  });

  route.post("/auth/2fa/disable", {
    schema: {
      tags: ["auth"],
      summary: "Desactiva el segundo factor (exige la contraseña)",
      body: passwordConfirmationSchema,
      response: { 200: messageResponseSchema },
    },
    preHandler: auth,
    config: { rateLimit: LIMITE_ESTRICTO },
    handler: authController.disableTwoFactor,
  });

  route.post("/auth/2fa/backup-codes", {
    schema: {
      tags: ["auth"],
      summary: "Regenera los códigos de respaldo (exige la contraseña)",
      body: passwordConfirmationSchema,
      response: { 200: backupCodesResponseSchema },
    },
    preHandler: auth,
    config: { rateLimit: LIMITE_ESTRICTO },
    handler: authController.regenerateBackupCodes,
  });
}
