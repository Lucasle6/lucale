import "server-only";

import type { Cart } from "@bodegon/shared";
import { cookies } from "next/headers";

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

/**
 * URL de la API para el SERVIDOR, absoluta.
 *
 * El servidor de Next llama a la API directamente, sin pasar por la
 * reescritura: no tiene cookies de navegador que proteger ni CORS que
 * respetar, y ahorrarse el rodeo es una petición menos por página.
 *
 * Sin el prefijo NEXT_PUBLIC_ a propósito: este valor no debe acabar en el
 * bundle que descarga el navegador.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";
const API_URL = `${API_ORIGIN}/v1`;

/** Base sin /v1, para componer las URLs de las imágenes servidas. */
export const FILES_URL = API_ORIGIN;

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

// ─── Carrito ─────────────────────────────────────────────────────────────────

/**
 * Lee el carrito desde un Server Component.
 *
 * A diferencia del catálogo, el carrito SÍ depende de quién mira: hay que
 * reenviar las cookies a mano y no se puede cachear. Cachear el carrito
 * mostraría el de otra persona.
 */
export async function getCartServer(): Promise<Cart> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(`${API_URL}/cart`, {
    headers: {
      accept: "application/json",
      ...(cookieHeader === "" ? {} : { cookie: cookieHeader }),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // Un fallo al leer el carrito no debe tumbar la página: se muestra vacío.
    return {
      lines: [],
      itemCount: 0,
      subtotalCents: 0,
      subtotalFormatted: "$0.00",
      hasIssues: false,
    };
  }

  return (await response.json()) as Cart;
}
