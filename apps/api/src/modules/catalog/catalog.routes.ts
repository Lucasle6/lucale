/**
 * Endpoints públicos del catálogo.
 *
 * Cada `schema` hace tres trabajos de una vez: valida la petición, tipa el
 * handler en TypeScript y genera la documentación OpenAPI de /docs.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as catalogController from "./catalog.controller.js";
import {
  categoryListResponseSchema,
  productDetailSchema,
  productListQuerySchema,
  productListResponseSchema,
  productParamsSchema,
} from "./catalog.schemas.js";

export function catalogRoutes(app: FastifyInstance): void {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get("/products", {
    schema: {
      tags: ["catalog"],
      summary: "Lista productos publicados, con filtros y paginación por cursor",
      querystring: productListQuerySchema,
      response: { 200: productListResponseSchema },
    },
    handler: catalogController.listProducts,
  });

  route.get("/products/:slug", {
    schema: {
      tags: ["catalog"],
      summary: "Ficha de un producto por su slug",
      params: productParamsSchema,
      response: { 200: productDetailSchema },
    },
    handler: catalogController.getProduct,
  });

  route.get("/categories", {
    schema: {
      tags: ["catalog"],
      summary: "Árbol de categorías (dos niveles)",
      response: { 200: categoryListResponseSchema },
    },
    handler: catalogController.listCategories,
  });
}
