import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { apiServer } from "../../lib/api-server";
import { CerrarSesion } from "./cerrar-sesion";

interface Perfil {
  email: string;
  role: string;
}

/**
 * Layout de las páginas protegidas.
 *
 * La carpeta se llama `(panel)` entre paréntesis: eso la convierte en un
 * "grupo de rutas" de Next, que agrupa páginas bajo un layout común SIN
 * añadir un segmento a la URL. Así /productos sigue siendo /productos y no
 * /panel/productos.
 *
 * La comprobación de sesión ocurre AQUÍ, en el servidor, antes de enviar nada
 * al navegador. No es un "if" en el cliente que oculte contenido ya
 * descargado: si no hay sesión, el HTML del panel nunca llega a salir.
 */
export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  let perfil: Perfil;
  try {
    perfil = await apiServer<Perfil>("/admin/auth/me");
  } catch {
    // Sin sesión válida (o sin 2FA activo) se vuelve al login.
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-surface-raised">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/productos" className="flex flex-col leading-tight">
              <span className="text-xs tracking-wide text-brand-600 uppercase">
                Bodegón de José
              </span>
              <span className="text-lg text-ink-900">Panel</span>
            </Link>
            <nav className="flex gap-1">
              <EnlaceNav href="/productos">Productos</EnlaceNav>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-500 sm:inline">{perfil.email}</span>
            <CerrarSesion />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

function EnlaceNav({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      {children}
    </Link>
  );
}
