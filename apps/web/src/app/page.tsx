import { Button } from "@bodegon/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { Header } from "../components/header";
import { ProductCard } from "../components/product-card";
import { listProducts } from "../lib/api";

export default async function HomePage(): Promise<ReactElement> {
  // Los seis primeros como destacados. Al ser Server Component, esta consulta
  // ocurre en el servidor y el HTML llega completo al navegador.
  const { items } = await listProducts({ limit: 6 });

  return (
    <>
      <Header />

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <p className="text-sm tracking-widest text-brand-600 uppercase">
            Hechas con calma
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight text-ink-900 sm:text-5xl">
            Salsas y aceites para cocinar todos los días
          </h1>
          <p className="mt-4 max-w-prose text-lg text-ink-700">
            Chiles tostados en comal y aceites infusionados en frío, en tandas pequeñas.
            Sin conservadores, sin prisa.
          </p>
          <div className="mt-8">
            <Link href="/productos">
              <Button size="lg">Ver el catálogo</Button>
            </Link>
          </div>
        </section>

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
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-ink-500">
        <p>LuCaLe · Cocina mexicana · Hecho en México</p>
      </div>
    </footer>
  );
}
