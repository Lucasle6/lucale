/**
 * Fábrica de la aplicación.
 *
 * Construye la app completa —plugins, rutas, manejadores— pero NO abre ningún
 * puerto. Arrancar es trabajo de index.ts.
 *
 * Esa separación es la que permite que los tests importen buildApp() y prueben
 * las rutas con app.inject(), simulando peticiones HTTP en memoria: sin
 * servidor real, sin puertos ocupados, en milisegundos.
 */

import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env, isDevelopment, isProduction } from "./config/env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSecurity } from "./plugins/security.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createLoggerMailer } from "./lib/mailer.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  // Bajo Vitest los logs se silencian: la salida de un test debe ser el
  // resultado de las pruebas, no el tráfico HTTP simulado.
  const isTest = env.VITEST !== undefined;

  const app = Fastify({
    logger: {
      level: isTest ? "silent" : env.LOG_LEVEL,
      // Sin esto, cada login escribiría la contraseña del usuario en texto
      // plano en los logs. Es una filtración silenciosa que se descubre tarde.
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "req.body.password",
          "req.body.currentPassword",
          "req.body.newPassword",
          "req.body.token",
          "req.body.totpCode",
        ],
        censor: "[REDACTADO]",
      },
      // Logs legibles en desarrollo; JSON en una línea en producción, que es
      // lo que saben ingerir los agregadores.
      ...(isDevelopment && !isTest
        ? {
            transport: {
              target: "pino-pretty",
              options: { translateTime: "HH:MM:ss" },
            },
          }
        : {}),
    },
    // No confiar en X-Forwarded-* salvo detrás de un proxy conocido: en
    // producción el balanceador es quien fija la IP real, y de ella depende el
    // rate limiting.
    trustProxy: isProduction,
  });

  // Conecta Zod con Fastify: los esquemas de las rutas validan y tipan.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerSecurity(app);
  registerErrorHandler(app);

  // La documentación no se publica en producción.
  if (!isProduction) {
    await registerSwagger(app);
  }

  app.get(
    "/health",
    { schema: { tags: ["system"], summary: "Estado del servicio" } },
    () => ({
      status: "ok",
      service: "bodegon-api",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }),
  );

  // El envío de correos se inyecta: hoy escribe en el log, en la Semana 3 será
  // Resend. Los services dependen de la interfaz, no del proveedor.
  const mailer = createLoggerMailer(app.log);

  // Versionamos desde el principio: publicar /v2 mañana no rompe a quien ya
  // consume /v1.
  await app.register(
    (instance) => {
      catalogRoutes(instance);
      authRoutes(instance, mailer);
      return Promise.resolve();
    },
    { prefix: "/v1" },
  );

  return app;
}
