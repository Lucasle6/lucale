/**
 * Errores de aplicación.
 *
 * Los services lanzan estos errores para expresar *qué* salió mal en términos
 * de negocio ("este producto no existe"), sin saber nada de HTTP. El manejador
 * central (plugins/error-handler.ts) los traduce a respuestas HTTP.
 *
 * Esa separación es lo que permite testear la lógica sin levantar un servidor.
 */

/** Base de todos los errores esperados de la aplicación. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    // new.target.name da el nombre de la subclase real (NotFoundError, etc.),
    // que es lo que aparecerá en los logs.
    this.name = new.target.name;
  }
}

/** 400 — los datos recibidos no cumplen las reglas. */
export class ValidationError extends AppError {
  constructor(message = "Los datos enviados no son válidos", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

/** 401 — no sabemos quién eres: falta autenticación o es inválida. */
export class UnauthorizedError extends AppError {
  constructor(message = "Necesitas iniciar sesión") {
    super(401, "UNAUTHORIZED", message);
  }
}

/** 403 — sabemos quién eres, pero no tienes permiso. */
export class ForbiddenError extends AppError {
  constructor(message = "No tienes permiso para esta acción") {
    super(403, "FORBIDDEN", message);
  }
}

/** 404 — el recurso no existe (o no debe ser visible para quien pregunta). */
export class NotFoundError extends AppError {
  constructor(message = "El recurso solicitado no existe") {
    super(404, "NOT_FOUND", message);
  }
}

/** 409 — choca con el estado actual: slug duplicado, stock insuficiente... */
export class ConflictError extends AppError {
  constructor(message = "La operación entra en conflicto con el estado actual") {
    super(409, "CONFLICT", message);
  }
}
