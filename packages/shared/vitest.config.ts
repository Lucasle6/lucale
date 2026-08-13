import { defineConfig } from "vitest/config";

/**
 * A diferencia de los tests de la API, estos no tocan la base de datos ni
 * levantan un servidor: son funciones puras entrando y saliendo. Por eso pueden
 * correr en paralelo y no necesitan el `fileParallelism: false` de allá.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
