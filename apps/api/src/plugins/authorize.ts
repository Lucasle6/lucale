/**
 * Autorización por rol (RBAC, control de seguridad nº 15).
 *
 * La regla: EL FRONTEND OCULTA, EL BACKEND PROHÍBE. Esconder un botón no es
 * seguridad, es decoración — cualquiera abre las herramientas del navegador y
 * hace la petición a mano. La comprobación vive aquí, en el servidor, en cada
 * ruta protegida.
 */

import { UserRole } from "@bodegon/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AUDIT_ACTIONS, auditContext, recordAudit } from "../lib/audit.js";
import { ForbiddenError } from "../lib/errors.js";
import { currentUser } from "./authenticate.js";

/**
 * Niveles de privilegio.
 *
 * Numéricos y no comparación de roles uno a uno: pedir "al menos ADMIN" acepta
 * también a SUPER_ADMIN de forma automática. Con listas explícitas por ruta,
 * tarde o temprano alguien añade un rol y olvida actualizar media docena de
 * sitios.
 */
const NIVEL: Record<UserRole, number> = {
  [UserRole.CUSTOMER]: 0,
  [UserRole.ADMIN]: 10,
  [UserRole.SUPER_ADMIN]: 20,
};

/** Exige un rol mínimo. Se usa como preHandler, después de requireAuth. */
export function requireRole(minimo: UserRole) {
  return async function authorize(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const user = currentUser(request);

    if (NIVEL[user.role] >= NIVEL[minimo]) return;

    // Un CUSTOMER tocando una ruta de admin no es un descuido: es alguien
    // probando puertas. Un intento es ruido; cincuenta desde la misma IP son
    // un ataque en curso, y solo se ve si queda registrado.
    await recordAudit(
      {
        actorId: user.id,
        action: AUDIT_ACTIONS.unauthorizedAccess,
        entityType: "Route",
        entityId: `${request.method} ${request.url}`,
        metadata: { rolActual: user.role, rolRequerido: minimo },
        ...auditContext(request),
      },
      request.log,
    );

    throw new ForbiddenError("No tienes permiso para esta acción");
  };
}

/** Atajos para las rutas. */
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

/**
 * Exige que el segundo factor esté activo.
 *
 * Para admins el 2FA no es opcional (a diferencia de los clientes): una
 * contraseña filtrada no puede bastar para entrar al panel que controla
 * precios, stock y reembolsos.
 *
 * Se comprueba aquí y no solo en el login porque un admin podría desactivarlo
 * después; esta guarda lo deja fuera hasta que vuelva a activarlo.
 */
// Nota sobre el `async` sin `await`: Fastify exige que un hook de dos
// parámetros devuelva una promesa. Si devuelve undefined, se queda esperando un
// callback `done` que nunca llega y la petición se cuelga. El fallo solo
// aparece cuando la guarda PASA, porque al lanzar sí funciona — costó un test
// colgado 15 segundos descubrirlo.
// eslint-disable-next-line @typescript-eslint/require-await
export async function requireTwoFactorEnabled(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const user = currentUser(request);

  if (user.twoFactorEnabledAt === null) {
    throw new ForbiddenError(
      "Debes activar el segundo factor para usar el panel de administración",
    );
  }
}
