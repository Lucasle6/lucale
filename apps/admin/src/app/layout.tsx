import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Panel · LuCaLe",
    template: "%s · Panel",
  },
  /**
   * El panel no debe aparecer en ningún buscador. Se declara aquí y también
   * como cabecera HTTP en next.config.ts: la cabecera funciona incluso para
   * respuestas que no son HTML, y algunos rastreadores solo miran una de las
   * dos.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="es-MX" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
