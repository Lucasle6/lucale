import Link from "next/link";
import type { ReactElement } from "react";
import { listCategories } from "../lib/api";

/**
 * Cabecera de la tienda.
 *
 * Es un Server Component: las categorías se leen en el servidor y llegan ya
 * dentro del HTML. Un rastreador de buscador ve los enlaces sin ejecutar nada.
 */
export async function Header(): Promise<ReactElement> {
  const { items: categorias } = await listCategories();

  return (
    <header className="border-b border-border-subtle bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-xs tracking-widest text-brand-600 uppercase">
            Impresión 3D
          </span>
          <span className="font-display text-xl text-ink-900">Bodegón de José</span>
        </Link>

        <nav aria-label="Categorías">
          <ul className="flex flex-wrap items-center gap-1">
            <li>
              <EnlaceNav href="/productos">Todo</EnlaceNav>
            </li>
            {categorias.map((categoria) => (
              <li key={categoria.id}>
                <EnlaceNav href={`/productos?categoria=${categoria.slug}`}>
                  {categoria.name}
                </EnlaceNav>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function EnlaceNav({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      {children}
    </Link>
  );
}
