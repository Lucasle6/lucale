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
    default: "Bodegón de José",
    template: "%s · Bodegón de José",
  },
  description:
    "Piezas de impresión 3D para decorar, ordenar y resolver. Hechas con calma.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="es-MX" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
