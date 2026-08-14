import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de punta a punta contra un navegador de verdad.
 *
 * POR QUÉ HACEN FALTA, si ya hay 191 pruebas. Porque las otras usan
 * `app.inject()`, que llama a los manejadores de Fastify sin pasar por la red
 * ni por un navegador. Eso deja fuera todo lo que vive en ese trayecto:
 *
 *   - CORS, que el Día 10 nos falló sin que ninguna prueba se enterara
 *   - CSRF, que el Día 13 rompió la tienda con las 172 pruebas en verde
 *   - CSP, que puede bloquear un script y dejar la página muerta
 *   - Las cookies, con sus reglas de SameSite y de origen
 *
 * Son las tres cosas que hemos roto sin darnos cuenta, y las tres viven
 * exactamente aquí.
 */

const PUERTO_WEB = 3100;
const PUERTO_API = 4100;

export default defineConfig({
  testDir: "./tests",

  // En serie: comparten base de datos y carrito. Paralelizar exigiría aislar
  // cada prueba, y no compensa para media docena de recorridos.
  fullyParallel: false,
  workers: 1,

  // Reintentos solo en CI. En local, una prueba que falla debe fallar y punto:
  // reintentar esconde la intermitencia justo cuando puedes investigarla.
  retries: process.env.CI === undefined ? 0 : 2,

  reporter:
    process.env.CI === undefined ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://localhost:${String(PUERTO_WEB)}`,
    // Rastro solo del primer reintento: pesa mucho y solo interesa cuando algo
    // falló de verdad.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /**
   * Levanta la API y la tienda en PUERTOS DISTINTOS a los de desarrollo.
   *
   * Así se puede correr la suite con el proyecto abierto sin que se peleen por
   * el puerto, y sin que una prueba toque el navegador que tengas usando.
   */
  webServer: [
    {
      command: "pnpm --filter @bodegon/api dev",
      port: PUERTO_API,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 60_000,
      env: {
        PORT: String(PUERTO_API),
        WEB_ORIGIN: `http://localhost:${String(PUERTO_WEB)}`,
        // La base de PRUEBAS, no la de desarrollo. Estos recorridos crean
        // carritos, y no tienen por qué ensuciar los datos con los que estás
        // trabajando. En CI además es la única que existe.
        DATABASE_URL:
          "postgresql://bodegon:bodegon_dev_password@localhost:5432/bodegon_test?schema=public",
      },
    },
    {
      command: "pnpm --filter @bodegon/web dev",
      port: PUERTO_WEB,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
      env: {
        PORT: String(PUERTO_WEB),
        // El navegador llama a /v1 del propio origen y Next lo reenvía aquí.
        // Es la misma forma que en producción, así que estas pruebas ejercitan
        // el camino real y no uno distinto.
        API_ORIGIN: `http://localhost:${String(PUERTO_API)}`,
      },
    },
  ],
});
