/**
 * Contratos del catálogo desde el panel de administración.
 *
 * Los precios llegan en CENTAVOS ENTEROS, no en pesos con decimales. El
 * formulario del admin muestra "149.90" pero envía 14990: la conversión ocurre
 * en el borde, y dentro del sistema el dinero nunca es decimal.
 */

import { z } from "zod";

/** Estados posibles de un producto, tal como los define el esquema Prisma. */
export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

/**
 * Slug: minúsculas, números y guiones. Es la URL pública del producto, así que
 * no admite espacios, acentos ni mayúsculas.
 */
export const slugSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "solo minúsculas, números y guiones simples entre palabras",
  );

// ─── Variantes ───────────────────────────────────────────────────────────────

export const variantInputSchema = z.object({
  /** El "tamaño" es texto libre: mañana puede ser talla, capacidad o color. */
  size: z.string().min(1).max(40),
  sku: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "mayúsculas, números y guiones"),
  // Entero y en centavos. El tope evita que un cero de más convierta un
  // producto de $150 en uno de $1,500,000 por un descuido de tecleo.
  priceCents: z.int().min(1).max(100_000_000),
  stock: z.int().min(0).max(1_000_000),
  weightGrams: z.int().min(0).max(1_000_000).optional(),
});

export const variantUpdateSchema = variantInputSchema.partial().extend({
  /** Presente = actualiza esa variante; ausente = crea una nueva. */
  id: z.uuid().optional(),
});

// ─── Productos ───────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(2).max(160),
  /** Si no se envía, se genera a partir del nombre. */
  slug: slugSchema.optional(),
  description: z.string().max(4000).optional(),
  categoryId: z.uuid().optional(),
  // Nace en borrador salvo que se diga lo contrario: así se puede armar con
  // calma sin que aparezca a medias en la tienda.
  status: productStatusSchema.default("DRAFT"),
  // Al menos una variante: un producto sin variantes no tiene precio, y sin
  // precio no se puede vender.
  variants: z.array(variantInputSchema).min(1).max(50),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  // El slug NO se regenera solo al cambiar el nombre: eso rompería enlaces
  // compartidos, marcadores y posicionamiento. Cambiarlo es una decisión
  // explícita.
  slug: slugSchema.optional(),
  description: z.string().max(4000).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  status: productStatusSchema.optional(),
  variants: z.array(variantUpdateSchema).max(50).optional(),
  /**
   * Marca de tiempo que el cliente leyó al abrir el formulario.
   *
   * Bloqueo optimista: si no coincide con la de la base, alguien más editó el
   * producto mientras trabajabas y guardar pisaría sus cambios sin que ninguno
   * de los dos se entere.
   */
  expectedUpdatedAt: z.iso.datetime(),
});

export const productParamsSchema = z.object({
  id: z.uuid(),
});

export const adminProductListQuerySchema = z.object({
  search: z.string().min(1).max(100).optional(),
  // A diferencia del catálogo público, aquí SÍ se pueden pedir borradores y
  // archivados: sin eso no se podrían gestionar.
  status: productStatusSchema.optional(),
  categoryId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.uuid().optional(),
});

// ─── Categorías ──────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: slugSchema.optional(),
  parentId: z.uuid().nullable().optional(),
  position: z.int().min(0).max(9999).default(0),
});

// ─── Salidas ─────────────────────────────────────────────────────────────────

export const adminVariantSchema = z.object({
  id: z.string(),
  size: z.string(),
  sku: z.string(),
  priceCents: z.int(),
  priceFormatted: z.string(),
  stock: z.int(),
  weightGrams: z.int().nullable(),
});

export const adminProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: productStatusSchema,
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  variants: z.array(adminVariantSchema),
  images: z.array(
    z.object({ id: z.string(), url: z.string(), alt: z.string().nullable() }),
  ),
  totalStock: z.int(),
  createdAt: z.string(),
  /** El cliente lo reenvía como expectedUpdatedAt al guardar. */
  updatedAt: z.string(),
});

export const adminProductListResponseSchema = z.object({
  items: z.array(adminProductSchema),
  nextCursor: z.string().nullable(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
