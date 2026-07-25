import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Los tests de integración comparten la misma base de datos: en serie para
    // que no se pisen entre sí.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
