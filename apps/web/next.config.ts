import type { NextConfig } from "next";

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
};

export default config;
