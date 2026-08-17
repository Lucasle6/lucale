import { Button, Card, EmptyState } from "@bodegon/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../../components/footer";
import { Header } from "../../components/header";
import { ProductCard } from "../../components/product-card";
import { listCategories, listProducts } from "../../lib/api";

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Salsas, aceites infusionados, sales y utensilios de cocina. Hechos en tandas pequeñas.",
};

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string }>;
}): Promise<ReactElement> {
  const params = await searchParams;

  // Las dos consultas se lanzan a la vez en vez de una tras otra: la página
  // tarda lo que la más lenta, no la suma de ambas.
  const [{ items }, { items: categorias }] = await Promise.all([
    listProducts({
      categorySlug: params.categoria,
      search: params.q,
      limit: 50,
    }),
    listCategories(),
  ]);

  const categoriaActiva = params.categoria;

  return (
    <>
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink-900">
            {categoriaActiva === undefined
              ? "Catálogo"
              : tituloDeCategoria(categorias, categoriaActiva)}
          </h1>
          <p className="mt-1 text-ink-500">
            {items.length === 1 ? "1 producto" : `${String(items.length)} productos`}
          </p>
        </header>

        <div className="mb-8 flex flex-wrap items-center gap-4">
          {/* Formulario HTML sin JavaScript: navega a la misma página con otros
              parámetros. Funciona aunque el bundle falle o tarde en cargar, y
              deja una URL compartible con el filtro aplicado. */}
          <form className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar un producto"
              aria-label="Buscar en el catálogo"
              className="h-10 w-56 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-ink-900 placeholder:text-ink-500"
            />
            {categoriaActiva !== undefined ? (
              <input type="hidden" name="categoria" value={categoriaActiva} />
            ) : null}
            <Button type="submit" variant="secondary" size="sm">
              Buscar
            </Button>
          </form>

          <ul className="flex flex-wrap gap-1">
            <li>
              <Chip href="/productos" activo={categoriaActiva === undefined}>
                Todo
              </Chip>
            </li>
            {categorias.flatMap((categoria) => [
              <li key={categoria.id}>
                <Chip
                  href={`/productos?categoria=${categoria.slug}`}
                  activo={categoriaActiva === categoria.slug}
                >
                  {categoria.name}
                </Chip>
              </li>,
              ...categoria.children.map((hija) => (
                <li key={hija.id}>
                  <Chip
                    href={`/productos?categoria=${hija.slug}`}
                    activo={categoriaActiva === hija.slug}
                  >
                    {hija.name}
                  </Chip>
                </li>
              )),
            ])}
          </ul>
        </div>

        {items.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No encontramos productos con esos filtros"
              description="Prueba con otra búsqueda o mira el catálogo completo."
              action={
                <Link href="/productos">
                  <Button>Ver todo</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((producto) => (
              <li key={producto.id}>
                <ProductCard producto={producto} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </>
  );
}

function tituloDeCategoria(
  categorias: {
    name: string;
    slug: string;
    children: { name: string; slug: string }[];
  }[],
  slug: string,
): string {
  for (const categoria of categorias) {
    if (categoria.slug === slug) return categoria.name;
    const hija = categoria.children.find((c) => c.slug === slug);
    if (hija !== undefined) return hija.name;
  }
  return "Catálogo";
}

function Chip({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}): ReactElement {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={
        activo
          ? "inline-block rounded-full bg-brand-600 px-3 py-1 text-sm font-medium text-white"
          : "inline-block rounded-full px-3 py-1 text-sm text-ink-700 hover:bg-brand-50"
      }
    >
      {children}
    </Link>
  );
}
