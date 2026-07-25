/**
 * Acceso a datos del catálogo. La ÚNICA capa que habla con Prisma.
 *
 * Ninguna regla de negocio vive aquí, y nada de esto sabe qué es HTTP. Si
 * mañana cambiáramos de ORM, solo se reescribiría este archivo.
 *
 * Regla de visibilidad: el filtro `status: ACTIVE` + `deletedAt: null` va
 * DENTRO de la consulta. Un borrador no sale de la base de datos, así que es
 * imposible que se filtre por descuido en una capa superior.
 */

import { Prisma, ProductStatus, prisma } from "@bodegon/db";

/** Solo productos publicados y no archivados. */
const visibleProduct = {
  status: ProductStatus.ACTIVE,
  deletedAt: null,
} satisfies Prisma.ProductWhereInput;

/** Variantes no archivadas, de la más barata a la más cara. */
const visibleVariants = {
  where: { deletedAt: null },
  orderBy: { priceCents: Prisma.SortOrder.asc },
} satisfies Prisma.Product$variantsArgs;

const productInclude = {
  variants: visibleVariants,
  images: { orderBy: { position: Prisma.SortOrder.asc } },
  category: { select: { slug: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export interface FindProductsParams {
  categorySlug?: string | undefined;
  search?: string | undefined;
  size?: string | undefined;
  minPriceCents?: number | undefined;
  maxPriceCents?: number | undefined;
  limit: number;
  cursor?: string | undefined;
}

/**
 * Listado paginado por cursor.
 *
 * Cursor y no offset: con offset, insertar filas mientras el usuario navega le
 * haría ver productos repetidos o saltarse algunos. El cursor ancla la página
 * a un registro concreto.
 *
 * Pide `limit + 1` a propósito: si vuelve el extra, hay más páginas.
 */
export function findProducts(
  params: FindProductsParams,
): Promise<ProductWithRelations[]> {
  const priceFilter: Prisma.ProductVariantWhereInput = { deletedAt: null };
  if (params.size !== undefined) priceFilter.size = params.size;
  if (params.minPriceCents !== undefined || params.maxPriceCents !== undefined) {
    priceFilter.priceCents = {
      ...(params.minPriceCents === undefined ? {} : { gte: params.minPriceCents }),
      ...(params.maxPriceCents === undefined ? {} : { lte: params.maxPriceCents }),
    };
  }

  const where: Prisma.ProductWhereInput = {
    ...visibleProduct,
    ...(params.categorySlug === undefined
      ? {}
      : { category: { slug: params.categorySlug } }),
    ...(params.search === undefined
      ? {}
      : {
          // insensitive: buscar "maceta" encuentra "Maceta Hexagonal".
          name: { contains: params.search, mode: Prisma.QueryMode.insensitive },
        }),
    // `some`: el producto entra si AL MENOS UNA variante cumple el filtro.
    variants: { some: priceFilter },
  };

  return prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { id: Prisma.SortOrder.asc },
    take: params.limit + 1,
    ...(params.cursor === undefined ? {} : { cursor: { id: params.cursor }, skip: 1 }),
  });
}

export function findProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  return prisma.product.findFirst({
    where: { slug, ...visibleProduct },
    include: productInclude,
  });
}

export function findCategoryTree() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { position: Prisma.SortOrder.asc },
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        orderBy: { position: Prisma.SortOrder.asc },
        select: { id: true, name: true, slug: true },
      },
    },
  });
}
