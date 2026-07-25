/**
 * Contratos del módulo de catálogo.
 *
 * Cada esquema hace tres trabajos a la vez: valida la petición en ejecución,
 * da el tipo a TypeScript en el handler, y genera la documentación OpenAPI.
 * Una sola definición, tres garantías: no pueden desincronizarse.
 */

import { z } from "zod";

// ─── Entradas ────────────────────────────────────────────────────────────────

export const productListQuerySchema = z.object({
  categorySlug: z.string().min(1).max(80).optional(),
  search: z.string().min(1).max(100).optional(),
  size: z.string().min(1).max(40).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  // El tope de 50 no es cosmético: sin él, `?limit=1000000` tumbaría la base.
  // La validación también protege recursos.
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional(),
});

export const productParamsSchema = z.object({
  slug: z.string().min(1).max(120),
});

// ─── Salidas ─────────────────────────────────────────────────────────────────

export const productVariantSchema = z.object({
  id: z.string(),
  size: z.string(),
  sku: z.string(),
  priceCents: z.int(),
  priceFormatted: z.string(),
  inStock: z.boolean(),
});

export const productImageSchema = z.object({
  url: z.string(),
  alt: z.string().nullable(),
});

/** Vista de listado: lo justo para pintar una tarjeta de producto. */
export const productSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  categorySlug: z.string().nullable(),
  // "desde $149.90": el precio de la variante más barata.
  priceFromCents: z.int(),
  priceFromFormatted: z.string(),
  sizes: z.array(z.string()),
  // Solo si hay stock, nunca cuánto: el inventario es información de negocio.
  inStock: z.boolean(),
  image: productImageSchema.nullable(),
});

/** Vista de ficha: todo lo necesario para la página de un producto. */
export const productDetailSchema = productSummarySchema.extend({
  description: z.string().nullable(),
  variants: z.array(productVariantSchema),
  images: z.array(productImageSchema),
});

export const productListResponseSchema = z.object({
  items: z.array(productSummarySchema),
  // null = no hay más páginas. El cliente lo reenvía como ?cursor=...
  nextCursor: z.string().nullable(),
});

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  children: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
});

export const categoryListResponseSchema = z.object({
  items: z.array(categorySchema),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
