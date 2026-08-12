/**
 * Defensas HTTP de base.
 *
 * Cubre los controles de seguridad de "higiene continua": cabeceras seguras,
 * CORS con allowlist explícita y rate limiting. Ver docs/03-seguridad.md.
 */

import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { ForbiddenError } from "../lib/errors.js";

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  // Cookies firmadas: si alguien manipula el valor, unsignCookie lo detecta.
  await app.register(cookie, { secret: env.COOKIE_SECRET });

  // Cabeceras de seguridad: X-Frame-Options (anti-clickjacking),
  // X-Content-Type-Options: nosniff, Strict-Transport-Security, etc.
  await app.register(helmet, {
    // Una API que devuelve JSON no renderiza HTML: la CSP con nonces pertenece
    // al frontend y se configura en el Día 12.
    contentSecurityPolicy: false,
    // DENY, no el SAMEORIGIN por defecto de Helmet: esta API nunca debe
    // aparecer dentro de un iframe, ni siquiera del propio dominio.
    frameguard: { action: "deny" },
  });

  // CORS con allowlist explícita, nunca `origin: true`. Sin esto, cualquier
  // sitio podría llamar a la API desde el navegador de un cliente con sesión
  // abierta. Los orígenes salen del .env validado con Zod.
  const allowedOrigins = new Set([env.WEB_ORIGIN, env.ADMIN_ORIGIN]);

  await app.register(cors, {
    origin(origin, callback) {
      // Sin cabecera Origin: peticiones que no vienen de un navegador
      // (curl, Postman, health checks). CORS no las protege de todos modos.
      if (origin === undefined) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenError(`Origen no permitido: ${origin}`), false);
    },
    // Permite que viajen las cookies de sesión (Día 4). Es justamente lo que
    // hace imprescindible la allowlist de arriba.
    credentials: true,
  });

  // Límite global por IP. En el Día 4 el login llevará uno mucho más estricto.
  //
  // Nota para el Día 15: en producción con varias instancias esto debe usar
  // Redis, porque cada instancia cuenta por separado y el límite real se
  // multiplica. Con una sola instancia la memoria basta.
  await app.register(rateLimit, {
    // Bajo Vitest se desactiva: un archivo de tests crea decenas de cuentas y
    // chocaría con el límite de 3 registros/hora, haciendo fallar pruebas que
    // no tienen nada que ver. Los límites se verifican por separado, contra el
    // servidor real, y en la auditoría del Día 12.
    global: env.VITEST === undefined,
    max: 100,
    timeWindow: "1 minute",
    // El plugin LANZA lo que devuelve esta función, así que el objeto debe
    // llevar statusCode: sin él, el manejador central no reconoce que es un
    // 4xx y responde 500 — el cliente creería que el servidor falló en vez de
    // entender que debe reintentar más tarde.
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      code: "RATE_LIMIT_EXCEEDED",
      message: `Demasiadas peticiones. Intenta de nuevo en ${context.after}.`,
    }),
  });

  // Respuestas comprimidas: menos ancho de banda, cargas más rápidas.
  await app.register(compress, { global: true });
}
