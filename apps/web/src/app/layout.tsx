import type { Metadata } from "next";
import { Karla, Updock } from "next/font/google";
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
 * Updock para títulos. Caligráfica formal, de un solo peso.
 *
 * Es una script de pluma: trazo fino, remates de entrada y salida en cada
 * letra, y ascendentes largas. Da el aire manuscrito y elegante que se buscaba.
 *
 * NO SE LE APLICA `italic`. Ya está inclinada por dibujo; pedirle cursiva
 * encima haría que el navegador la incline artificialmente y deforme las letras
 * —lo que se llama una falsa cursiva—.
 *
 * TAMPOCO SE LE APLICA INTERLETRADO NEGATIVO. En una script las letras se
 * enlazan, y apretarlas más las hace chocar entre sí en vez de encadenarlas.
 *
 * Su punto débil es el tamaño pequeño: con un trazo tan fino, un título de 18px
 * sobre carbón pierde definición. Por eso los títulos de sección se piden más
 * grandes de lo que pedirían con una serif normal.
 */
const updock = Updock({
  subsets: ["latin"],
  variable: "--font-updock",
  display: "swap",
  weight: "400",
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
      className={`${karla.variable} ${updock.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
