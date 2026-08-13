import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@bodegon/ui", "@bodegon/shared"],
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },

  /**
   * Cabeceras del panel.
   *
   * `X-Robots-Tag: noindex` es la tercera capa contra el descubrimiento: aunque
   * alguien enlace el panel por error, los buscadores no lo indexarán. Las
   * otras dos son la app separada (este bundle no llega al navegador de un
   * cliente) y el aislamiento por audiencia del token.
   *
   * `DENY` en X-Frame-Options impide que el panel se cargue dentro de un
   * iframe: sin eso, un sitio malicioso podría superponerle botones invisibles
   * y hacer que un admin pulse cosas sin saberlo (clickjacking). En la tienda
   * es una molestia; en el panel que controla precios y reembolsos, es grave.
   */
  // Next exige que `headers` sea async aunque el valor sea estático.
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default config;
