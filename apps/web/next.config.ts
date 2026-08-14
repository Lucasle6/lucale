import type { NextConfig } from "next";

/**
 * Origen de la API, SOLO para el servidor.
 *
 * No lleva el prefijo NEXT_PUBLIC_ a propósito: no debe acabar en el bundle del
 * navegador, porque el navegador ya no llama a la API directamente.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const config: NextConfig = {
  // Los paquetes del monorepo se compilan aquí en vez de consumirse ya
  // construidos: así un cambio en packages/ui se refleja al instante en
  // desarrollo, sin tener que reconstruir nada.
  transpilePackages: ["@bodegon/ui", "@bodegon/shared"],

  // Oculta la cabecera "X-Powered-By: Next.js": no hay razón para anunciar
  // qué framework y qué versión corre el servidor.
  poweredByHeader: false,

  typescript: {
    // Los errores de tipo rompen el build a propósito. El typecheck ya corre
    // en CI, pero esto lo hace imposible de saltar.
    ignoreBuildErrors: false,
  },

  /**
   * EL NAVEGADOR SOLO HABLA CON ESTE DOMINIO. La API queda detrás.
   *
   * POR QUÉ. Las cookies pertenecen a un dominio. Con la tienda en
   * `lucale.vercel.app` y la API en `lucale-api.onrender.com`, cualquier cookie
   * que ponga la API es "de terceros" para el navegador — y con `SameSite=Lax`
   * simplemente se descarta. El carrito deja de funcionar, y el CSRF también,
   * porque su token viaja en una cookie que nunca llega a guardarse.
   *
   * En desarrollo no se veía: `localhost:3000` y `localhost:4000` son el MISMO
   * host, y el puerto no cuenta para las cookies. El problema solo existe en
   * producción, y solo porque desplegamos en dos empresas distintas.
   *
   * Con esta reescritura el navegador pide a `/v1/...` de su propio origen y
   * Next lo reenvía. Las cookies vuelven a ser de primera parte, el CORS deja
   * de intervenir, y nada de esto depende de que los navegadores sigan
   * aceptando cookies de terceros — algo que llevan años retirando.
   *
   * Sigue funcionando igual el día que haya dominio propio.
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
