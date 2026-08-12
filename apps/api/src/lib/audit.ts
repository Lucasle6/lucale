/**
 * Registro de auditoría de acciones administrativas.
 *
 * Control de seguridad nº 17. No previene nada: REGISTRA. Y es igual de
 * importante, porque responde la pregunta que ningún otro control responde:
 * "¿quién hizo esto?".
 *
 * Es append-only por diseño: se escribe, nunca se edita ni se borra, ni
 * siquiera por un admin. Un registro de auditoría que el sospechoso puede
 * modificar no vale nada.
 *
 * Lo que NO se registra: contraseñas, tokens, secretos. Un audit log con datos
 * sensibles se convierte en un segundo sitio desde donde filtrarlos. Se anota
 * QUÉ campos cambiaron, no sus valores cuando son secretos.
 */

import type { Prisma } from "@bodegon/db";
import { prisma } from "@bodegon/db";
import type { FastifyBaseLogger, FastifyRequest } from "fastify";

/**
 * Acciones auditables. Un enum de strings en vez de texto libre: si cada quien
 * escribe la acción a mano, con el tiempo hay "product.update",
 * "product.updated" y "updateProduct" para lo mismo, y el log deja de poder
 * filtrarse.
 */
export const AUDIT_ACTIONS = {
  adminLoginSuccess: "admin.login.success",
  adminLoginFailed: "admin.login.failed",
  adminLogout: "admin.logout",
  adminTwoFactorEnabled: "admin.2fa.enabled",
  adminTwoFactorDisabled: "admin.2fa.disabled",
  adminPasswordChanged: "admin.password.changed",
  adminRoleChanged: "admin.role.changed",
  productCreated: "product.created",
  productUpdated: "product.updated",
  productArchived: "product.archived",
  orderRefunded: "order.refunded",
  orderFulfilled: "order.fulfilled",
  unauthorizedAccess: "security.unauthorized_access",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  /** Quién. null si la acción falló antes de identificar a nadie. */
  actorId?: string | null;
  action: AuditAction;
  /** Sobre qué recurso: "Product", "Order", "User"... */
  entityType: string;
  entityId?: string | null;
  /**
   * Detalle del cambio. NUNCA valores sensibles.
   *
   * Se tipa con el JSON de Prisma en vez de Record<string, unknown> para que
   * TypeScript rechace de entrada valores que la columna jsonb no admite.
   */
  metadata?: Prisma.InputJsonObject | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Escribe una entrada.
 *
 * Nunca lanza: si el registro fallara, no debe tumbar la operación que el
 * usuario estaba haciendo. Un fallo aquí se reporta en los logs del servidor,
 * que es donde alguien lo verá.
 */
export async function recordAudit(
  entry: AuditEntry,
  log: FastifyBaseLogger,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    log.error({ err: error, entry }, "No se pudo escribir el registro de auditoría");
  }
}

/** Extrae IP y user-agent de la petición, para no repetirlo en cada llamada. */
export function auditContext(request: FastifyRequest): {
  ip: string;
  userAgent: string | undefined;
} {
  return { ip: request.ip, userAgent: request.headers["user-agent"] };
}
