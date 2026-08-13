/**
 * Middleware de autenticación.
 *
 * Lee el access token (de la cookie o de la cabecera Authorization), verifica
 * su firma y deja el usuario en `request.currentUser` para los handlers.
 *
 * El parámetro `audience` es lo que aísla el mundo de admin del de clientes: la
 * comprobación es CRIPTOGRÁFICA, no un `if`. Un token de cliente presentado en
 * una ruta de admin falla al verificarse la firma, antes de llegar a ninguna
 * lógica de permisos.
 *
 * SE ENGANCHA EN `onRequest`, NO EN `preHandler` (Día 13).
 *
 * El ciclo de vida de Fastify es:
 *
 *   onRequest → preParsing → preValidation → [validación] → preHandler → handler
 *
 * Con el guardia en `preHandler`, la validación del esquema corría ANTES de
 * autenticar. Consecuencia medible: una petición sin sesión con el cuerpo mal
 * formado recibía un 400 con el detalle de los campos, y una con el cuerpo
 * correcto recibía un 401. Comparando ambas respuestas, cualquiera sin sesión
 * podía deducir el esquema completo de la API de administración.
 *
 * No concedía acceso, pero regalaba reconocimiento — la fase previa de
 * cualquier ataque dirigido.
 *
 * Aquí solo se leen cookies y cabeceras, disponibles ya en `onRequest`, así que
 * el cuerpo no hace falta. Ventaja añadida: rechaza antes de gastar CPU en
 * parsear cuerpos grandes de quien no tiene por qué estar ahí.
 */

import type { User } from "@bodegon/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../lib/errors.js";
import { COOKIE_NAMES, verifyAccessToken } from "../lib/jwt.js";
import type { TokenAudience } from "../lib/jwt.js";
import * as authRepository from "../modules/auth/auth.repository.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: User;
  }
}

/**
 * Extrae el token. Se aceptan dos vías:
 *   - Cookie firmada: la usa el navegador (httpOnly, inaccesible a JavaScript).
 *   - Authorization: Bearer — para clientes que no son navegador.
 */
function leerToken(request: FastifyRequest): string | null {
  const cookie = request.cookies[COOKIE_NAMES.accessToken];
  if (cookie !== undefined) {
    const unsigned = request.unsignCookie(cookie);
    if (unsigned.valid && unsigned.value !== null) return unsigned.value;
  }

  const header = request.headers.authorization;
  if (header !== undefined && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  return null;
}

export function requireAuth(audience: TokenAudience) {
  return async function authenticate(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const token = leerToken(request);
    if (token === null) {
      throw new UnauthorizedError("Necesitas iniciar sesión");
    }

    let payload;
    try {
      payload = await verifyAccessToken(token, audience);
    } catch {
      // Firma inválida, caducado o audiencia equivocada: todo lo mismo hacia
      // fuera, para no dar pistas sobre qué falló exactamente.
      throw new UnauthorizedError("Tu sesión no es válida. Inicia sesión de nuevo.");
    }

    // Se relee el usuario en cada petición: el token es de vida corta, pero en
    // esos minutos la cuenta pudo archivarse o cambiar de rol.
    const user = await authRepository.findUserById(payload.sub);
    if (user === null) {
      throw new UnauthorizedError("Tu sesión no es válida. Inicia sesión de nuevo.");
    }

    request.currentUser = user;
  };
}

/** Devuelve el usuario autenticado o lanza. Evita repetir la comprobación. */
export function currentUser(request: FastifyRequest): User {
  if (request.currentUser === undefined) {
    throw new UnauthorizedError("Necesitas iniciar sesión");
  }
  return request.currentUser;
}
