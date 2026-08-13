import type { MetadataRoute } from "next";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * robots.txt, servido en /robots.txt.
 *
 * El panel no aparece aquí a propósito. Podría parecer buena idea escribir
 * `Disallow: /admin`, pero robots.txt es PÚBLICO: cualquiera lo lee, y listar
 * lo que quieres ocultar es señalarlo con el dedo. El panel vive en otro
 * dominio y ya se protege con noindex, audiencia de token y rol.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /design-system es una página interna de referencia, no contenido.
      disallow: ["/design-system"],
    },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
