import Link from "next/link";
import type { ReactElement } from "react";
import { getCartServer, listCategories } from "../lib/api";

/**
 * Cabecera de la tienda.
 *
 * Es un Server Component: las categorías se leen en el servidor y llegan ya
 * dentro del HTML. Un rastreador de buscador ve los enlaces sin ejecutar nada.
 */
export async function Header(): Promise<ReactElement> {
  // Las dos consultas van en paralelo. La de categorías se cachea 5 minutos;
  // la del carrito nunca, porque depende de quién mire.
  const [{ items: categorias }, carrito] = await Promise.all([
    listCategories(),
    getCartServer(),
  ]);

  return (
    <header className="border-b border-border-subtle bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-xs tracking-widest text-brand-600 uppercase">
            Cocina mexicana
          </span>
          <span className="font-display text-xl text-ink-900">LuCaLe</span>
        </Link>

        <div className="flex items-center gap-2">
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

          <Link
            href="/carrito"
            className="flex items-center gap-2 rounded-md border border-border-strong px-3 py-1.5 text-sm text-ink-900 transition-colors hover:border-brand-400"
          >
            {/* La palabra "Carrito" se sustituye por el icono, pero el <span>
                sr-only de abajo NO se toca: es lo que oye un lector de pantalla.
                Un icono sin nombre accesible es un botón mudo — el usuario oye
                "enlace" y nada más. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              {/* Asa de la bolsa */}
              <path d="M8 8V6a4 4 0 0 1 8 0v2" />
              {/* Cuerpo */}
              <path d="M4.5 8h15l-1.1 11a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4.5 8z" />
            </svg>
            {carrito.itemCount > 0 ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-medium text-bg">
                {carrito.itemCount}
              </span>
            ) : null}
            <span className="sr-only">
              Ver carrito
              {carrito.itemCount > 0
                ? `, ${String(carrito.itemCount)} ${carrito.itemCount === 1 ? "producto" : "productos"}`
                : " (vacío)"}
            </span>
          </Link>
        </div>
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
