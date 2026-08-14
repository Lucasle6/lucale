import type { NextConfig } from "next";

/** Origen de la API, solo para el servidor. Sin NEXT_PUBLIC_ a propósito. */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

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

  /**
   * El navegador solo habla con este dominio; la API queda detrás.
   *
   * Sin esto, la cookie de sesión que pone la API sería "de terceros" para el
   * navegador y se descartaría: el panel no podría mantener la sesión abierta.
   * Ver la explicación larga en apps/web/next.config.ts.
   */
  // Devuelve la promesa en vez de ser `async` sin `await`: Next espera una
  // promesa, y así no hace falta silenciar ninguna regla del linter.
  rewrites() {
    return Promise.resolve([
      {
        source: "/v1/:path*",
        destination: `${API_ORIGIN}/v1/:path*`,
      },
    ]);
  },
};

export default config;
