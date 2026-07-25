/**
 * Punto de entrada: arranca la aplicación y la apaga con cuidado.
 *
 * Todo lo demás (plugins, rutas, manejadores) vive en app.ts. Aquí solo se
 * enciende el servidor y se gestionan las señales del sistema.
 */

import { prisma } from "@bodegon/db";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

// Apagado ordenado: Fastify deja de aceptar conexiones nuevas y espera a que
// terminen las que están en curso. Sin esto, un despliegue corta peticiones a
// medias.
let shuttingDown = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    // Docker y Kubernetes reenvían la señal si el proceso tarda. Sin esta
    // guarda, el segundo SIGTERM entra a la mitad del cierre y lo deja
    // incompleto.
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info(`${signal} recibido, cerrando el servidor...`);

    // Red de seguridad: si una conexión se queda colgada, salimos por las
    // malas. unref() evita que este temporizador sea justamente lo que impida
    // salir.
    const forceExit = setTimeout(() => {
      process.stderr.write("Cierre ordenado agotó su tiempo, saliendo a la fuerza\n");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    void app
      .close()
      .then(() => prisma.$disconnect())
      .then(
        () => {
          clearTimeout(forceExit);
          // A propósito NO llamamos a process.exit(0). pino escribe desde un
          // worker thread, y process.exit lo mata antes de que vacíe su búfer:
          // se pierden justo los últimos logs, los que explican por qué se
          // cerró. Al no forzar la salida, Node termina solo cuando el event
          // loop queda vacío, y para entonces el worker ya escribió todo.
        },
        (error: unknown) => {
          clearTimeout(forceExit);
          app.log.error(error, "Fallo al cerrar el servidor");
          process.exit(1);
        },
      );
  });
}
