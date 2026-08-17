import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../components/footer";
import { FormularioContacto } from "../components/formulario-contacto";
import { Header } from "../components/header";
import { Hero } from "../components/hero";
import { ProductCard } from "../components/product-card";
import { Resenas } from "../components/resenas";
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

      <Resenas />
      <FormularioContacto />

      <Footer />
    </>
  );
}
