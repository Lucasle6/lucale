/**
 * Manejador de errores centralizado.
 *
 * Un solo lugar decide cómo se ve cualquier error de la API. Los controllers no
 * necesitan try/catch: lanzan y esto se encarga.
 *
 * La regla de seguridad: el cliente recibe un mensaje útil pero genérico; el
 * detalle (stack, consulta SQL, rutas de archivos) va SOLO al log. Un stack
 * trace en la respuesta le regala a un atacante la estructura interna.
 */

import type { FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError } from "../lib/errors.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;

    // 1. Validación de Zod: el cliente mandó datos inválidos. Aquí SÍ damos
    //    detalle de qué campo falló — le sirve para corregir y no revela nada
    //    nuestro.
    if (hasZodFastifySchemaValidationErrors(error)) {
      request.log.info({ err: error }, "Petición con datos inválidos");
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Los datos enviados no son válidos",
          details: error.validation,
          requestId,
        },
      });
    }

    // 2. Error nuestro y esperado: ya trae su código y su mensaje. Se registra
    //    como info, no como error: un 404 es funcionamiento normal.
    if (error instanceof AppError) {
      request.log.info({ err: error }, "Error de aplicación");
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
          requestId,
        },
      });
    }

    // 3. Cuerpo malformado u otros errores de Fastify con código 4xx.
    //    El type guard de Zod de arriba ensancha `error` a unknown, así que
    //    comprobamos la forma antes de leer sus campos.
    const fastifyError = error as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (
      typeof fastifyError.statusCode === "number" &&
      fastifyError.statusCode >= 400 &&
      fastifyError.statusCode < 500
    ) {
      request.log.info({ err: error }, "Petición rechazada");
      return reply.status(fastifyError.statusCode).send({
        error: {
          code: fastifyError.code ?? "BAD_REQUEST",
          message: fastifyError.message ?? "Petición inválida",
          requestId,
        },
      });
    }

    // 4. Cualquier otra cosa: es un bug. Detalle completo al log, mensaje
    //    genérico al cliente. El requestId es el puente entre ambos.
    request.log.error({ err: error }, "Error no controlado");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error interno. Intenta de nuevo más tarde.",
        requestId,
      },
    });
  });

  // Ruta inexistente: mismo formato de error que todo lo demás.
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `No existe la ruta ${request.method} ${request.url}`,
        requestId: request.id,
      },
    });
  });
}
