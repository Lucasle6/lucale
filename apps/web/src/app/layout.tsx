import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

/**
 * next/font descarga las fuentes al compilar y las sirve desde nuestro propio
 * dominio. No hay petición a Google desde el navegador del usuario: es más
 * rápido, evita un salto de red y no obliga a abrir la CSP a un dominio
 * externo (Día 12).
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "LuCaLe",
    template: "%s · LuCaLe",
  },
  description:
    "Salsas, aceites infusionados y despensa, hechos en tandas pequeñas. Cocina mexicana de todos los días.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    /* `data-tema` lo lee packages/ui/src/tokens.css y redefine ahí la paleta
       entera. Va en el <html> y no en el <body> para que el color de fondo
       pinte también la zona de rebote al hacer scroll más allá del final, que
       si no aparece blanca y delata el truco.

       El panel NO lo pone: se administra mejor en claro. */
    <html
      lang="es-MX"
      data-tema="oscuro"
      className={`${inter.variable} ${fraunces.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
