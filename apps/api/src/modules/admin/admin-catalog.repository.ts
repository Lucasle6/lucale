/**
 * Acceso a datos del catálogo desde el panel.
 *
 * Separado del repository público a propósito: aquí SÍ se ven borradores y
 * archivados. Si compartieran consultas, un descuido dejaría los borradores
 * visibles en la tienda.
 */

// Prisma se importa como valor y no solo como tipo: además de los tipos
// (Prisma.ProductWhereInput) se usan sus enums en tiempo de ejecución
// (Prisma.SortOrder.asc, Prisma.QueryMode.insensitive).
import { Prisma, prisma } from "@bodegon/db";

const productInclude = {
  variants: {
    where: { deletedAt: null },
    orderBy: { priceCents: Prisma.SortOrder.asc },
  },
  images: { orderBy: { position: Prisma.SortOrder.asc } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

export type AdminProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export interface FindProductsParams {
  search?: string | undefined;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED" | undefined;
  categoryId?: string | undefined;
  limit: number;
  cursor?: string | undefined;
}

export function findProducts(params: FindProductsParams): Promise<AdminProduct[]> {
  const where: Prisma.ProductWhereInput = {
    // Sin filtro de status: el panel necesita ver todo para gestionarlo.
    deletedAt: null,
    ...(params.status === undefined ? {} : { status: params.status }),
    ...(params.categoryId === undefined ? {} : { categoryId: params.categoryId }),
    ...(params.search === undefined
      ? {}
      : {
          OR: [
            { name: { contains: params.search, mode: Prisma.QueryMode.insensitive } },
            // El admin suele buscar por SKU, que es como identifica las piezas
            // en su inventario físico.
            {
              variants: {
                some: {
                  sku: { contains: params.search, mode: Prisma.QueryMode.insensitive },
                },
              },
            },
          ],
        }),
  };

  return prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { id: Prisma.SortOrder.asc },
    take: params.limit + 1,
    ...(params.cursor === undefined ? {} : { cursor: { id: params.cursor }, skip: 1 }),
  });
}

export function findProductById(id: string): Promise<AdminProduct | null> {
  return prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: productInclude,
  });
}

export function findProductBySlug(slug: string): Promise<{ id: string } | null> {
  return prisma.product.findUnique({ where: { slug }, select: { id: true } });
}

export function findVariantBySku(sku: string): Promise<{ id: string } | null> {
  return prisma.productVariant.findUnique({ where: { sku }, select: { id: true } });
}

export function createProduct(data: Prisma.ProductCreateInput): Promise<AdminProduct> {
  return prisma.product.create({ data, include: productInclude });
}

/**
 * Actualiza SOLO si `updatedAt` sigue siendo el esperado.
 *
 * Es el bloqueo optimista: si otro admin guardó mientras este tenía el
 * formulario abierto, la condición no se cumple, ninguna fila cambia y
 * devolvemos null. Sin esto, el segundo en guardar pisaría los cambios del
 * primero y ninguno se enteraría.
 */
export async function updateProductIfUnchanged(
  id: string,
  expectedUpdatedAt: Date,
  // updateMany no admite escrituras anidadas, así que las variantes se
  // gestionan aparte, dentro de la misma transacción del service.
  data: Prisma.ProductUpdateManyMutationInput,
): Promise<AdminProduct | null> {
  const resultado = await prisma.product.updateMany({
    where: { id, updatedAt: expectedUpdatedAt, deletedAt: null },
    data,
  });

  if (resultado.count === 0) return null;
  return findProductById(id);
}

export function archiveProduct(id: string): Promise<{ id: string }> {
  // Se archiva, NO se borra: el producto aparece en facturas y en el historial
  // de pedidos, y borrarlo dejaría esos registros huérfanos.
  return prisma.product.update({
    where: { id },
    data: { status: "ARCHIVED" },
    select: { id: true },
  });
}

// ─── Variantes ───────────────────────────────────────────────────────────────

export function createVariant(
  data: Prisma.ProductVariantUncheckedCreateInput,
): Promise<{ id: string }> {
  return prisma.productVariant.create({ data, select: { id: true } });
}

export function updateVariant(
  id: string,
  data: Prisma.ProductVariantUpdateInput,
): Promise<{ id: string }> {
  return prisma.productVariant.update({ where: { id }, data, select: { id: true } });
}

/** Archiva la variante en vez de borrarla, por la misma razón que el producto. */
export function softDeleteVariant(id: string): Promise<{ id: string }> {
  return prisma.productVariant.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true },
  });
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export function createCategory(
  data: Prisma.CategoryUncheckedCreateInput,
): Promise<{ id: string; name: string; slug: string }> {
  return prisma.category.create({
    data,
    select: { id: true, name: true, slug: true },
  });
}

export function findCategoryBySlug(slug: string): Promise<{ id: string } | null> {
  return prisma.category.findUnique({ where: { slug }, select: { id: true } });
}

export function categoryExists(id: string): Promise<{ id: string } | null> {
  return prisma.category.findUnique({ where: { id }, select: { id: true } });
}

// ─── Imágenes ────────────────────────────────────────────────────────────────

export function createProductImage(data: {
  productId: string;
  url: string;
  alt?: string | undefined;
  position: number;
  width?: number | undefined;
  height?: number | undefined;
}): Promise<{ id: string; url: string }> {
  return prisma.productImage.create({
    data: {
      productId: data.productId,
      url: data.url,
      alt: data.alt ?? null,
      position: data.position,
      width: data.width ?? null,
      height: data.height ?? null,
    },
    select: { id: true, url: true },
  });
}

export function countProductImages(productId: string): Promise<number> {
  return prisma.productImage.count({ where: { productId } });
}

export function deleteProductImage(id: string): Promise<{ id: string; url: string }> {
  // Las imágenes SÍ se borran de verdad: no aparecen en facturas y ocupan
  // espacio real en el almacenamiento.
  return prisma.productImage.delete({ where: { id }, select: { id: true, url: true } });
}

export function findProductImage(
  id: string,
): Promise<{ id: string; productId: string; url: string } | null> {
  return prisma.productImage.findUnique({
    where: { id },
    select: { id: true, productId: true, url: true },
  });
}
