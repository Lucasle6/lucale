/**
 * Rutas del catálogo en el panel de administración.
 *
 * Todas llevan las tres capas de aislamiento del Día 5: audiencia "admin" en
 * el token, rol mínimo ADMIN, y segundo factor activo.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { TOKEN_AUDIENCE } from "../../lib/jwt.js";
import type { Storage } from "../../lib/storage.js";
import { requireAuth } from "../../plugins/authenticate.js";
import { requireAdmin, requireTwoFactorEnabled } from "../../plugins/authorize.js";
import { messageResponseSchema } from "../auth/auth.schemas.js";
import * as controller from "./admin-catalog.controller.js";
import {
  adminProductListQuerySchema,
  adminProductListResponseSchema,
  adminProductSchema,
  createCategorySchema,
  createProductSchema,
  productParamsSchema,
  updateProductSchema,
} from "@bodegon/shared";

const imageResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  width: z.int(),
  height: z.int(),
  bytes: z.int(),
});

export function adminCatalogRoutes(app: FastifyInstance, storage: Storage): void {
  const route = app.withTypeProvider<ZodTypeProvider>();
  // Las tres capas, en toda ruta del panel.
  const protegido = [
    requireAuth(TOKEN_AUDIENCE.admin),
    requireAdmin,
    requireTwoFactorEnabled,
  ];

  route.get("/admin/products", {
    schema: {
      tags: ["admin"],
      summary: "Lista productos, incluidos borradores y archivados",
      querystring: adminProductListQuerySchema,
      response: { 200: adminProductListResponseSchema },
    },
    onRequest: protegido,
    handler: controller.listProducts,
  });

  route.get("/admin/products/:id", {
    schema: {
      tags: ["admin"],
      summary: "Detalle de un producto para editarlo",
      params: productParamsSchema,
      response: { 200: adminProductSchema },
    },
    onRequest: protegido,
    handler: controller.getProduct,
  });

  route.post("/admin/products", {
    schema: {
      tags: ["admin"],
      summary: "Crea un producto con sus variantes",
      body: createProductSchema,
      response: { 201: adminProductSchema },
    },
    onRequest: protegido,
    handler: controller.createProduct,
  });

  route.patch("/admin/products/:id", {
    schema: {
      tags: ["admin"],
      summary: "Actualiza un producto (exige expectedUpdatedAt)",
      params: productParamsSchema,
      body: updateProductSchema,
      response: { 200: adminProductSchema },
    },
    onRequest: protegido,
    handler: controller.updateProduct,
  });

  route.delete("/admin/products/:id", {
    schema: {
      tags: ["admin"],
      summary: "Archiva un producto (no lo borra)",
      params: productParamsSchema,
      response: { 200: messageResponseSchema },
    },
    onRequest: protegido,
    handler: controller.archiveProduct,
  });

  route.post("/admin/categories", {
    schema: {
      tags: ["admin"],
      summary: "Crea una categoría",
      body: createCategorySchema,
      response: {
        201: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
      },
    },
    onRequest: protegido,
    handler: controller.createCategory,
  });

  // ── Imágenes ───────────────────────────────────────────────────────────────
  // Sin `body` en el esquema: multipart no se valida con Zod, se procesa en el
  // controller. La validación de verdad son los magic bytes.

  app.post("/admin/products/:id/images", {
    schema: {
      tags: ["admin"],
      summary: "Sube una imagen (valida el contenido real, no la extensión)",
      params: productParamsSchema,
      response: { 201: imageResponseSchema },
      consumes: ["multipart/form-data"],
    },
    onRequest: protegido,
    handler: controller.uploadImage(storage),
  });

  route.delete("/admin/products/:id/images/:imageId", {
    schema: {
      tags: ["admin"],
      summary: "Elimina una imagen del producto",
      params: z.object({ id: z.uuid(), imageId: z.uuid() }),
      response: { 200: messageResponseSchema },
    },
    onRequest: protegido,
    handler: controller.deleteImage(storage),
  });
}
