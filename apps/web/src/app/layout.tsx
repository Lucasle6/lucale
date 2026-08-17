import type { Metadata } from "next";
import { Instrument_Serif, Karla } from "next/font/google";
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
 * Instrument Serif para títulos, y se usa en ITÁLICA.
 *
 * Su itálica no es la redonda inclinada: tiene formas propias, con enlaces y
 * remates que vienen de la escritura a mano. Es lo que da ese aire semi-cursivo
 * sin caer en una tipografía de caligrafía, que a tamaño grande se lee mal y
 * envejece fatal.
 *
 * Solo trae un peso, y es correcto para un display: una serif de alto contraste
 * en negrita se empasta y pierde justo los trazos finos que la hacen elegante.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
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
      className={`${karla.variable} ${instrumentSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
