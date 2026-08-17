import { Revelar } from "@bodegon/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../page";
import { Header } from "../../components/header";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "LuCaLe son Luis y Caro. Salsas y aceites hechos en Zapopan, Jalisco, en tandas pequeñas, con recetas trabajadas desde 2020.",
};

/**
 * Página "Nosotros".
 *
 * TODO LO QUE SE AFIRMA AQUÍ SALE DE `docs/06-contenido-del-sitio.md`, escrito
 * por los dueños. No hay una sola frase inventada: ni el año, ni las horas de
 * reposo, ni el origen del nombre. Si algo de esto cambia, se cambia allí
 * primero y luego aquí — una página "quiénes somos" con datos adornados es la
 * clase de cosa que se sostiene hasta que alguien pregunta.
 */
export default function NosotrosPage(): ReactElement {
  return (
    <>
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Revelar>
          <p className="text-sm tracking-widest text-brand-700 uppercase">Nosotros</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink-900 sm:text-5xl">
            LuCaLe son dos nombres
          </h1>
        </Revelar>

        <Revelar retraso={90}>
          <p className="mt-8 text-lg leading-relaxed text-ink-700">
            Detrás de la marca estamos <strong className="text-ink-900">Luis</strong> y{" "}
            <strong className="text-ink-900">Caro</strong>. El nombre no es una palabra
            que buscáramos en un diccionario: son las primeras letras de los nuestros,
            puestas una junto a la otra.
          </p>
        </Revelar>

        <Revelar retraso={140}>
          <p className="mt-6 text-lg leading-relaxed text-ink-700">
            Empezamos a trabajar las recetas en{" "}
            <strong className="text-ink-900">2020</strong> y llevamos produciendo a nivel
            local desde <strong className="text-ink-900">2021</strong>, desde{" "}
            <strong className="text-ink-900">Zapopan, Jalisco</strong>.
          </p>
        </Revelar>

        <Revelar retraso={190}>
          <h2 className="mt-16 font-display text-2xl text-ink-900">Cómo lo hacemos</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-700">
            Todo se hace de forma artesanal, con cuidado particular en cada salsa y cada
            receta, para poder ofrecer la misma calidad en cada gota. Nuestras salsas
            tienen notas tostadas y colores brillantes, y eso viene de la primera calidad
            de los chiles: no hay forma de conseguirlo con materia prima mediana.
          </p>
        </Revelar>

        <Revelar retraso={240}>
          {/* El dato de las 168 horas es el más concreto que dieron, y por eso se
              destaca en vez de quedar enterrado en un párrafo: una cifra
              verificable convence más que tres adjetivos. */}
          <figure className="mt-10 border-l-2 border-brand-600 pl-6">
            <p className="font-display text-2xl leading-snug text-ink-900">
              Nuestros aceites reposan hasta 168 horas.
            </p>
            <figcaption className="mt-3 text-ink-500">
              Una semana entera de infusión en frío, para extraer todo el sabor y
              quedarnos solo con ese tesoro líquido.
            </figcaption>
          </figure>
        </Revelar>

        <Revelar retraso={290}>
          <div className="mt-16 flex flex-wrap gap-3 border-t border-border-subtle pt-10">
            <Link
              href="/productos"
              className="text-brand-700 underline-offset-4 hover:underline"
            >
              Ver el catálogo →
            </Link>
            <span aria-hidden="true" className="text-ink-500">
              ·
            </span>
            <Link
              href="/contacto"
              className="text-brand-700 underline-offset-4 hover:underline"
            >
              Hablar con nosotros →
            </Link>
          </div>
        </Revelar>
      </main>

      <Footer />
    </>
  );
}
