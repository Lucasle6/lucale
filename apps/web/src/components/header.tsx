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
            Impresión 3D
          </span>
          <span className="font-display text-xl text-ink-900">Bodegón de José</span>
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
            <span aria-hidden="true">Carrito</span>
            {carrito.itemCount > 0 ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-xs text-white">
                {carrito.itemCount}
              </span>
            ) : null}
            {/* El texto visible dice solo "Carrito"; el lector de pantalla
                recibe la frase completa con la cantidad. */}
            <span className="sr-only">
              Ver carrito
              {carrito.itemCount > 0
                ? `, ${String(carrito.itemCount)} ${carrito.itemCount === 1 ? "pieza" : "piezas"}`
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
