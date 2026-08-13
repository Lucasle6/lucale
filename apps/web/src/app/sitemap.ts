import type { MetadataRoute } from "next";
import { listCategories, listProducts } from "../lib/api";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Sitemap generado desde el catálogo real.
 *
 * Next lo sirve en /sitemap.xml. Al construirse desde la API, un producto
 * nuevo aparece solo: no hay una lista que mantener a mano y que acabe
 * desactualizada.
 *
 * Solo incluye productos PUBLICADOS, porque eso es lo único que devuelve la
 * API pública. Un borrador nunca puede colarse aquí.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ items: productos }, { items: categorias }] = await Promise.all([
    listProducts({ limit: 50 }),
    listCategories(),
  ]);

  const paginasFijas: MetadataRoute.Sitemap = [
    { url: SITIO, changeFrequency: "weekly", priority: 1 },
    { url: `${SITIO}/productos`, changeFrequency: "daily", priority: 0.9 },
  ];

  const paginasDeCategoria: MetadataRoute.Sitemap = categorias.flatMap((categoria) => [
    {
      url: `${SITIO}/productos?categoria=${categoria.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    ...categoria.children.map((hija) => ({
      url: `${SITIO}/productos?categoria=${hija.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]);

  const paginasDeProducto: MetadataRoute.Sitemap = productos.map((producto) => ({
    url: `${SITIO}/productos/${producto.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...paginasFijas, ...paginasDeCategoria, ...paginasDeProducto];
}
