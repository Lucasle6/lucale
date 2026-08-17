import { CarruselCentrado, MarcadorFoto, Revelar } from "@bodegon/ui";
import Link from "next/link";
import type { ReactElement } from "react";

/**
 * Los cinco niveles de picor.
 *
 * ES LA PRIMERA SECCIÓN DESPUÉS DEL HERO, y ese sitio no es casual: quien llega
 * a una tienda de salsas sin conocerla tiene una única pregunta antes que
 * cualquier otra —"¿esto me va a picar demasiado?"—. Contestarla antes de
 * enseñar precios es lo que convierte una lista de productos en una tienda.
 *
 * ⚠ EL NIVEL DE PICOR NO EXISTE EN LA BASE DE DATOS. El modelo `Product` no
 * tiene ningún campo de intensidad, así que esta sección describe la ESCALA,
 * no afirma qué producto está en cada nivel. Cada tarjeta lleva al catálogo.
 *
 * PARA COMPLETARLA hacen falta dos cosas, en este orden:
 *   1. Un campo `heatLevel` en Product, con su migración y su casilla en el
 *      panel — es dato del producto, no decoración de la portada.
 *   2. Que los dueños digan qué nivel tiene cada uno de sus seis chiles.
 *
 * Hasta entonces, inventar el mapeo sería mentir sobre cuánto pica algo que
 * alguien va a comerse.
 */

interface Nivel {
  numero: number;
  nombre: string;
  descripcion: string;
}

const NIVELES: Nivel[] = [
  {
    numero: 1,
    nombre: "Suave",
    descripcion: "Aporta sabor sin calor. Para cocinar a diario y para quien no pica.",
  },
  {
    numero: 2,
    nombre: "Templada",
    descripcion: "Se nota, pero no interrumpe. El punto donde el chile empieza a hablar.",
  },
  {
    numero: 3,
    nombre: "Media",
    descripcion: "Pica de verdad y se sostiene. El nivel que más se repite en la mesa.",
  },
  {
    numero: 4,
    nombre: "Brava",
    descripcion: "Para quien busca el golpe. Se usa a cucharadita, no a cucharada.",
  },
  {
    numero: 5,
    nombre: "Para valientes",
    descripcion: "El extremo de la escala. Avisados quedan.",
  },
];

export function NivelesDePicor(): ReactElement {
  return (
    <section className="border-t border-border-subtle py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Revelar>
          <p className="text-sm tracking-widest text-brand-700 uppercase">
            Escala del 1 al 5
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-5xl text-ink-900">
            ¿Cuánto pica lo que te vas a comer?
          </h2>
          <p className="mt-5 max-w-prose text-lg text-ink-700">
            Es lo primero que preguntan, así que va primero. Cinco niveles, del que solo
            da sabor al que muerde.
          </p>
        </Revelar>
      </div>

      {/* A ancho completo, no dentro del contenedor: el carrusel se corta por
          los lados a propósito y encerrarlo mataría ese efecto. */}
      <Revelar retraso={90}>
        <CarruselCentrado etiqueta="Niveles de picor" className="mt-12">
          {NIVELES.map((nivel) => (
            <article
              key={nivel.numero}
              data-tarjeta
              className="flex w-72 shrink-0 snap-center flex-col gap-4 rounded-xl border border-border-subtle bg-surface p-6"
            >
              <div className="aspect-[4/5] w-full overflow-hidden rounded-lg">
                <MarcadorFoto semilla={`nivel-${String(nivel.numero)}`} />
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-medium text-brand-600 tabular-nums">
                  {nivel.numero}
                </span>
                <h3 className="font-display text-3xl text-ink-900">{nivel.nombre}</h3>
              </div>

              <p className="text-sm text-ink-700">{nivel.descripcion}</p>

              <Escala nivel={nivel.numero} />
            </article>
          ))}
        </CarruselCentrado>
      </Revelar>

      <div className="mx-auto mt-10 max-w-6xl px-6">
        <Revelar>
          <Link
            href="/productos?categoria=machas"
            className="text-brand-700 underline-offset-4 hover:underline"
          >
            Ver todas las salsas →
          </Link>
        </Revelar>
      </div>
    </section>
  );
}

/** Cinco marcas, las encendidas indican el nivel. */
function Escala({ nivel }: { nivel: number }): ReactElement {
  return (
    <div className="mt-auto flex items-center gap-1.5 pt-2">
      {/* El texto lo dice; las marcas son decoración. Cinco elementos sin nombre
          se leerían uno por uno y no informarían de nada. */}
      <span className="sr-only">Nivel {nivel} de 5</span>
      {Array.from({ length: 5 }, (_, indice) => (
        <span
          key={indice}
          aria-hidden="true"
          className={
            indice < nivel
              ? "h-1.5 flex-1 rounded-full bg-brand-600"
              : "h-1.5 flex-1 rounded-full bg-border-subtle"
          }
        />
      ))}
    </div>
  );
}
