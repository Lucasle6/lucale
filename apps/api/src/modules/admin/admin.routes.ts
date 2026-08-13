/**
 * Rutas del panel de administración.
 *
 * Aislamiento en tres capas independientes (control de seguridad nº 8):
 *
 *   1. AUDIENCIA   requireAuth(admin) exige aud:"admin" en el token. Un token
 *                  de cliente falla al verificarse la FIRMA, antes de llegar a
 *                  ninguna comprobación de rol.
 *   2. ROL         requireAdmin exige al menos ADMIN, y deja el intento en el
 *                  registro de auditoría si no lo tiene.
 *   3. 2FA         requireTwoFactorEnabled: sin segundo factor no hay panel.
 *
 * Las tres son redundantes a propósito. Si una fallara por un error futuro, las
 * otras dos siguen en pie.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../../config/env.js";
import { TOKEN_AUDIENCE } from "../../lib/jwt.js";
import type { Mailer } from "../../lib/mailer.js";
import { requireAuth } from "../../plugins/authenticate.js";
import { requireAdmin, requireTwoFactorEnabled } from "../../plugins/authorize.js";
import {
  emailSchema,
  messageResponseSchema,
  userProfileSchema,
} from "../auth/auth.schemas.js";
import * as adminController from "./admin.controller.js";

const EN_TESTS = env.VITEST !== undefined;
/** Más estricto que el de clientes: el panel controla precios y reembolsos. */
const LIMITE_PANEL = EN_TESTS ? false : { max: 5, timeWindow: "15 minutes" };

const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const challengeSchema = z.object({
  challengeToken: z.string().min(20).max(1000),
});

const completeLoginSchema = z
  .object({
    challengeToken: z.string().min(20).max(1000),
    totpCode: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    backupCode: z.string().min(10).max(20).optional(),
  })
  .refine((v) => v.totpCode !== undefined || v.backupCode !== undefined, {
    message: "Envía el código de tu app o uno de respaldo",
  });

const confirmSchema = z.object({
  challengeToken: z.string().min(20).max(1000),
  totpCode: z.string().regex(/^\d{6}$/),
});

/** El login de admin NUNCA entrega sesión: siempre pide el segundo factor. */
const adminLoginResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("two_factor_required"), challengeToken: z.string() }),
  z.object({
    status: z.literal("two_factor_setup_required"),
    challengeToken: z.string(),
  }),
]);

const authenticatedResponseSchema = z.object({
  status: z.literal("authenticated"),
  user: userProfileSchema,
});

export function adminRoutes(app: FastifyInstance, mailer: Mailer): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  // Audiencia "admin": esta es la primera capa del aislamiento.
  const auth = requireAuth(TOKEN_AUDIENCE.admin);

  route.post("/admin/auth/login", {
    schema: {
      tags: ["admin"],
      summary: "Primer paso del acceso al panel (siempre exige segundo factor)",
      body: adminLoginSchema,
      response: { 200: adminLoginResponseSchema },
    },
    config: { rateLimit: LIMITE_PANEL },
    handler: adminController.login(mailer),
  });

  route.post("/admin/auth/2fa/setup", {
    schema: {
      tags: ["admin"],
      summary: "Genera el QR para un admin que aún no tiene segundo factor",
      body: challengeSchema,
      response: {
        200: z.object({ qrDataUrl: z.string(), manualEntryKey: z.string() }),
      },
    },
    config: { rateLimit: LIMITE_PANEL },
    handler: adminController.setupTwoFactor,
  });

  route.post("/admin/auth/2fa/confirm", {
    schema: {
      tags: ["admin"],
      summary: "Activa el segundo factor y abre la sesión",
      body: confirmSchema,
      response: {
        200: authenticatedResponseSchema.extend({
          backupCodes: z.array(z.string()),
          message: z.string(),
        }),
      },
    },
    config: { rateLimit: LIMITE_PANEL },
    handler: adminController.confirmTwoFactor,
  });

  route.post("/admin/auth/login/2fa", {
    schema: {
      tags: ["admin"],
      summary: "Completa el acceso con el código del segundo factor",
      body: completeLoginSchema,
      response: { 200: authenticatedResponseSchema },
    },
    config: { rateLimit: LIMITE_PANEL },
    handler: adminController.completeLogin,
  });

  route.post("/admin/auth/logout", {
    schema: {
      tags: ["admin"],
      summary: "Cierra la sesión del panel",
      response: { 200: messageResponseSchema },
    },
    onRequest: [auth, requireAdmin],
    handler: adminController.logout,
  });

  route.get("/admin/auth/me", {
    schema: {
      tags: ["admin"],
      summary: "Perfil del administrador autenticado",
      response: { 200: userProfileSchema },
    },
    // Las tres capas juntas: audiencia, rol y segundo factor.
    onRequest: [auth, requireAdmin, requireTwoFactorEnabled],
    handler: adminController.me,
  });
}
