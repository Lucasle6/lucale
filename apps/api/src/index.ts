/**
 * Punto de entrada de la API.
 *
 * Hoy (Día 1) solo demuestra que los cimientos funcionan: el entorno se valida,
 * el servidor arranca y responde. El esqueleto real por capas —rutas, controllers,
 * services, repositories, manejo de errores, Helmet, CORS, rate limiting— se monta
 * en el Día 3 (Módulo 2). Ver docs/00-plan-maestro.md.
 */

import Fastify from "fastify";
import { formatMoney } from "@bodegon/shared";
import { env, isDevelopment } from "./config/env.js";

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    // En desarrollo, logs legibles por humanos. En producción, JSON en una línea,
    // que es lo que saben ingerir los agregadores de logs.
    ...(isDevelopment
      ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } } }
      : {}),
  },
});

app.get("/health", () => {
  return {
    status: "ok",
    service: "bodegon-api",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };
});

/**
 * Prueba de que el monorepo está bien cableado: este importe se formatea con una
 * función que vive en @bodegon/shared, el mismo paquete que mañana usará el
 * frontend. Si el enlace entre paquetes se rompe, esta ruta deja de compilar.
 */
app.get("/demo/money", () => {
  const priceCents = 149_90;
  return {
    priceCents,
    formatted: formatMoney(priceCents),
    note: "El dinero viaja en centavos enteros y solo se formatea al mostrarlo.",
  };
});

async function start(): Promise<void> {
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Apagado ordenado: al recibir la señal, Fastify deja de aceptar conexiones nuevas
// y espera a que terminen las que están en curso. Sin esto, un despliegue corta
// peticiones a medias.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} recibido, cerrando el servidor...`);
    void app.close().then(() => process.exit(0));
  });
}

await start();
