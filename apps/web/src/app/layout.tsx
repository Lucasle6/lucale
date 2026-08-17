import type { Metadata } from "next";
import { Cormorant_Garamond, Karla } from "next/font/google";
import "./globals.css";

/**
 * next/font descarga las fuentes al compilar y las sirve desde nuestro propio
 * dominio. No hay petición a Google desde el navegador del usuario: es más
 * rápido, evita un salto de red y no obliga a abrir la CSP a un dominio
 * externo (Día 12).
 */
/**
 * Karla para interfaz. Grotesca con carácter propio, no neutra hasta lo
 * anónimo: Inter es la tipografía por defecto de medio internet y de casi todo
 * lo autogenerado, y precisamente por eso se reconoce al instante.
 */
const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

/**
 * Cormorant Garamond para títulos. Una garalda clásica de alto contraste —los
 * trazos finos muy finos, los gruesos muy gruesos—, que es de donde viene su
 * aire de imprenta antigua.
 *
 * SE PIDEN PESOS ALTOS a propósito. En su peso normal, sobre fondo oscuro, los
 * trazos finos casi desaparecen y el titular se ve enfermizo. A 500 y 600
 * aguanta el carbón y gana presencia sin volverse pesada.
 */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
  weight: ["400", "500", "600"],
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
      className={`${karla.variable} ${cormorant.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
