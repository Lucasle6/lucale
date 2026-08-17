import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../components/footer";
import { FormularioContacto } from "../components/formulario-contacto";
import { Header } from "../components/header";
import { NivelesDePicor } from "../components/niveles";
import { PorQue } from "../components/por-que";
import { PuntosClave } from "../components/puntos-clave";
import { Hero } from "../components/hero";
import { Revelar } from "@bodegon/ui";
import { ProductCard } from "../components/product-card";
import { Resenas } from "../components/resenas";
import { listProducts } from "../lib/api";

export default async function HomePage(): Promise<ReactElement> {
  // Solo TRES, y es deliberado: la portada enseña una muestra para abrir el
  // apetito, no el inventario. El catálogo completo vive en /productos.
  const { items } = await listProducts({ limit: 3 });

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

        {/* EL ORDEN ES EL ARGUMENTO, no una lista de secciones.

            1. Hero — qué es esto
            2. Niveles — la duda que frena la compra: ¿cuánto pica?
            3. Puntos clave — las cifras que justifican el precio
            4. Por qué — cómo se llega a esas cifras
            5. Recién hechas — RECIÉN AHORA se enseña producto, cuando ya hay
               contexto para entenderlo
            6. Reseñas — la prueba social va al final, no al principio: convence
               a quien ya está considerando, no a quien acaba de llegar

            Antes la portada volcaba el catálogo entero justo después del hero.
            Quien llegaba sin conocer la marca veía catorce frascos y ningún
            motivo para elegir uno. */}
        <NivelesDePicor />
        <PuntosClave />
        <PorQue />

        <section className="border-t border-border-subtle bg-surface/40">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-5xl text-ink-900">Recién hechas</h2>
                <p className="mt-3 text-ink-700">Una muestra del catálogo.</p>
              </div>
              <Link href="/productos" className="text-brand-700 hover:underline">
                Ver todo →
              </Link>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((producto, indice) => (
                <Revelar as="li" key={producto.id} retraso={indice * 60}>
                  <ProductCard producto={producto} />
                </Revelar>
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
