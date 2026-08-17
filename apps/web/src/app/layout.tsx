import type { Metadata } from "next";
import { Karla, Playfair_Display } from "next/font/google";
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
 * Playfair Display para títulos, y se usa en ITÁLICA.
 *
 * Es una didona: contraste extremo entre el trazo grueso y el fino, y remates
 * finísimos y horizontales. De ahí su aire de revista y de portada de libro.
 *
 * Su itálica no es la redonda inclinada — tiene formas propias, con enlaces de
 * pluma, que es lo que da el aire semi-cursivo pedido.
 *
 * SE PIDEN PESOS ALTOS. En una didona el trazo fino es MUY fino; a peso normal
 * y sobre carbón, esos trazos se rompen y el titular parece descolorido. A 500
 * y 600 el contraste se mantiene pero la letra aguanta el fondo oscuro.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["500", "600"],
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
      className={`${karla.variable} ${playfair.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
