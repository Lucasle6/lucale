/**
 * Documentación OpenAPI generada automáticamente.
 *
 * No se escribe a mano: sale de los mismos esquemas Zod que validan cada
 * endpoint. Eso significa que la documentación no puede quedar desactualizada
 * — si cambia la validación, cambia la doc.
 *
 * Disponible en /docs solo fuera de producción.
 */

import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "LuCaLe — API",
        description: "API del e-commerce. Catálogo, cuentas, carrito y pedidos.",
        version: "0.1.0",
      },
      tags: [{ name: "catalog", description: "Catálogo público de productos" }],
    },
    // Convierte los esquemas Zod de cada ruta en OpenAPI.
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
}
