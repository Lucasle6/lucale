import "server-only";

/**
 * Cliente de la API para la tienda.
 *
 * A diferencia del panel, aquí NO se reenvían cookies: el catálogo es público
 * y no depende de quién mire. Eso permite algo que el panel no puede hacer:
 * cachear.
 *
 * `revalidate: 60` guarda el HTML generado y lo sirve de caché durante un
 * minuto. Con 1.000 visitas al mes, sin esto cada visita golpearía la base de
 * datos; con esto, la base recibe una consulta por minuto.
 *
 * El `server-only` de arriba hace fallar la compilación si alguien importa
 * este archivo desde un Client Component.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

/** Base sin /v1, para componer las URLs de las imágenes servidas. */
export const FILES_URL = API_URL.replace(/\/v1$/, "");

/** Segundos que el catálogo se sirve de caché antes de refrescarse. */
const REVALIDATE_SECONDS = 60;

export class NotFound extends Error {}

async function pedir<T>(path: string, revalidate = REVALIDATE_SECONDS): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (response.status === 404) {
    throw new NotFound(path);
  }
  if (!response.ok) {
    throw new Error(`La API respondió ${String(response.status)} en ${path}`);
  }

  return (await response.json()) as T;
}

// ─── Tipos que expone la API pública ─────────────────────────────────────────

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  categorySlug: string | null;
  priceFromCents: number;
  priceFromFormatted: string;
  sizes: string[];
  /** Solo si hay stock, nunca cuánto: el inventario no se expone. */
  inStock: boolean;
  image: { url: string; alt: string | null } | null;
}

export interface ProductVariant {
  id: string;
  size: string;
  sku: string;
  priceCents: number;
  priceFormatted: string;
  inStock: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  variants: ProductVariant[];
  images: { url: string; alt: string | null }[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
}

// ─── Consultas ───────────────────────────────────────────────────────────────

export interface FiltrosCatalogo {
  categorySlug?: string | undefined;
  search?: string | undefined;
  size?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export function listProducts(
  filtros: FiltrosCatalogo = {},
): Promise<{ items: ProductSummary[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (filtros.categorySlug !== undefined) query.set("categorySlug", filtros.categorySlug);
  if (filtros.search !== undefined) query.set("search", filtros.search);
  if (filtros.size !== undefined) query.set("size", filtros.size);
  query.set("limit", String(filtros.limit ?? 24));
  if (filtros.cursor !== undefined) query.set("cursor", filtros.cursor);

  return pedir(`/products?${query.toString()}`);
}

export function getProduct(slug: string): Promise<ProductDetail> {
  return pedir(`/products/${encodeURIComponent(slug)}`);
}

export function listCategories(): Promise<{ items: Category[] }> {
  // Las categorías cambian aún menos que los productos: se cachean más tiempo.
  return pedir("/categories", 300);
}

/** Compone la URL absoluta de una imagen servida por la API. */
export function imageUrl(url: string): string {
  return `${FILES_URL}${url}`;
}
