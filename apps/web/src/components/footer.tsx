import Link from "next/link";
import type { ReactElement } from "react";
import { CORREOS, UBICACION, WHATSAPP_MX } from "../lib/contacto";

/**
 * Pie del sitio.
 *
 * Vive aquí y no dentro de `app/page.tsx` porque lo usan siete páginas: tenerlo
 * en la portada obligaba a las demás a importar desde `../page`, que es una
 * dependencia rara —una página importando de otra página— y arrastraba la
 * consulta del catálogo de la portada a sitios que no la necesitan.
 *
 * ORGANIZADO EN COLUMNAS por tema y no como una lista larga: en un pie, el
 * usuario no lee, BUSCA. Tres bloques cortos con encabezado se recorren de un
 * vistazo; doce enlaces seguidos obligan a leerlos todos.
 */

const AÑO = new Date().getFullYear();

const TIENDA = [
  { href: "/productos", texto: "Todo el catálogo" },
  { href: "/productos?categoria=machas", texto: "Salsas macha" },
  { href: "/productos?categoria=picantes", texto: "Salsas picantes" },
  { href: "/productos?categoria=aceites", texto: "Aceites infusionados" },
];

const CASA = [
  { href: "/nosotros", texto: "Nosotros" },
  { href: "/contacto", texto: "Contacto" },
  { href: "/preguntas", texto: "Preguntas frecuentes" },
];

export function Footer(): ReactElement {
  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-2xl text-ink-900">LuCaLe</p>
            <p className="mt-3 max-w-xs text-sm text-ink-500">
              Salsas y aceites infusionados hechos en tandas pequeñas en{" "}
              {UBICACION.ciudad}, {UBICACION.estado}.
            </p>
          </div>

          <nav aria-labelledby="pie-tienda">
            <h2 id="pie-tienda" className="text-sm font-medium text-ink-900">
              Tienda
            </h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {TIENDA.map((enlace) => (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    className="text-ink-500 transition-colors hover:text-brand-700"
                  >
                    {enlace.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="pie-casa">
            <h2 id="pie-casa" className="text-sm font-medium text-ink-900">
              La casa
            </h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {CASA.map((enlace) => (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    className="text-ink-500 transition-colors hover:text-brand-700"
                  >
                    {enlace.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-medium text-ink-900">Escríbenos</h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <li>
                <a
                  href={WHATSAPP_MX.enlace}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-500 transition-colors hover:text-brand-700"
                >
                  WhatsApp {WHATSAPP_MX.visible}
                </a>
              </li>
              {CORREOS.map((correo) => (
                <li key={correo}>
                  <a
                    href={`mailto:${correo}`}
                    className="break-all text-ink-500 transition-colors hover:text-brand-700"
                  >
                    {correo}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-8 text-sm text-ink-500">
          <p>
            © {AÑO} LuCaLe · Hecho en {UBICACION.ciudad}, {UBICACION.estado}
          </p>
          <Link
            href="/privacidad"
            className="transition-colors hover:text-brand-700 hover:underline"
          >
            Aviso de privacidad
          </Link>
        </div>
      </div>
    </footer>
  );
}
