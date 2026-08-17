import Link from "next/link";
import type { ReactElement } from "react";
import { Header } from "../components/header";
import { Hero } from "../components/hero";
import { ProductCard } from "../components/product-card";
import { listProducts } from "../lib/api";

export default async function HomePage(): Promise<ReactElement> {
  // Los seis primeros como destacados. Al ser Server Component, esta consulta
  // ocurre en el servidor y el HTML llega completo al navegador.
  const { items } = await listProducts({ limit: 6 });

  // El primero del catálogo protagoniza el hero. Cuando no tenga foto, el
  // componente pone el marcador provisional en su lugar.
  const primero = items[0];
  const destacadoDelHero =
    primero === undefined
      ? undefined
      : {
          nombre: primero.name,
          slug: primero.slug,
          imagenUrl: primero.image?.url ?? null,
        };

  return (
    <>
      <Header />

      <main>
        <Hero destacado={destacadoDelHero} />

        <section className="border-t border-border-subtle bg-surface/60">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl text-ink-900">Recién hechas</h2>
              <Link href="/productos" className="text-sm text-brand-700 hover:underline">
                Ver todo →
              </Link>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((producto) => (
                <li key={producto.id}>
                  <ProductCard producto={producto} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export function Footer(): ReactElement {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-ink-500">
        <p>LuCaLe · Cocina mexicana · Hecho en Zapopan, Jalisco</p>

        {/* Nosotros y Contacto van aquí y no en la cabecera a propósito: arriba
            compiten con las categorías, que es lo que alguien viene a buscar. */}
        <nav aria-label="Enlaces del sitio">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/nosotros" className="hover:text-ink-700 hover:underline">
                Nosotros
              </Link>
            </li>
            <li>
              <Link href="/contacto" className="hover:text-ink-700 hover:underline">
                Contacto
              </Link>
            </li>
            <li>
              <Link href="/preguntas" className="hover:text-ink-700 hover:underline">
                Preguntas frecuentes
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
