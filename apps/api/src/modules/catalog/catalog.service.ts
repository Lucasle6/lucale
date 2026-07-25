/**
 * Reglas de negocio del catálogo.
 *
 * No sabe qué es HTTP: lanza NotFoundError, nunca "un 404". No sabe qué es
 * Prisma: pide datos al repository. Por eso se puede testear sin levantar
 * servidor ni base de datos.
 *
 * También traduce: la API no expone las filas de la base tal cual, sino lo que
 * el cliente necesita. Esa capa de traducción es lo que impide que un cambio
 * interno del esquema rompa a todos los clientes.
 */

import { formatMoney } from "@bodegon/shared";
import { NotFoundError } from "../../lib/errors.js";
import * as catalogRepository from "./catalog.repository.js";
import type { ProductWithRelations } from "./catalog.repository.js";
import type { ProductListQuery } from "./catalog.schemas.js";

function toSummary(product: ProductWithRelations) {
  const prices = product.variants.map((variant) => variant.priceCents);
  // El repository ordena las variantes por precio ascendente, así que la
  // primera es la más barata. Si no hubiera ninguna, 0 evita un NaN.
  const priceFromCents = prices[0] ?? 0;
  const firstImage = product.images[0];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categorySlug: product.category?.slug ?? null,
    priceFromCents,
    priceFromFormatted: formatMoney(priceFromCents),
    sizes: product.variants.map((variant) => variant.size),
    // Solo si hay stock, nunca cuánto: el inventario no se expone al público.
    inStock: product.variants.some((variant) => variant.stock > 0),
    image: firstImage === undefined ? null : { url: firstImage.url, alt: firstImage.alt },
  };
}

function toDetail(product: ProductWithRelations) {
  return {
    ...toSummary(product),
    description: product.description,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      sku: variant.sku,
      priceCents: variant.priceCents,
      priceFormatted: formatMoney(variant.priceCents),
      inStock: variant.stock > 0,
    })),
    images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
  };
}

export async function listProducts(query: ProductListQuery) {
  const products = await catalogRepository.findProducts(query);

  // El repository pidió limit + 1. Si vino el extra, hay más páginas: lo
  // quitamos de la respuesta y usamos el último visible como cursor.
  const hasMore = products.length > query.limit;
  const items = hasMore ? products.slice(0, query.limit) : products;
  const last = items.at(-1);

  return {
    items: items.map(toSummary),
    nextCursor: hasMore && last !== undefined ? last.id : null,
  };
}

export async function getProductBySlug(slug: string) {
  const product = await catalogRepository.findProductBySlug(slug);

  // Se lanza el error de negocio; el manejador central lo traduce a HTTP.
  if (product === null) {
    throw new NotFoundError("El producto solicitado no existe");
  }

  return toDetail(product);
}

export async function listCategories() {
  const categories = await catalogRepository.findCategoryTree();
  return { items: categories };
}
