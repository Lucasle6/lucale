import { Carrusel, Revelar } from "@bodegon/ui";
import type { ReactElement } from "react";

/**
 * Reseñas de clientes.
 *
 * ⚠ CONTENIDO DE MUESTRA. Estas reseñas NO son de clientes reales: la tienda
 * todavía no ha vendido. Están aquí para la presentación del proyecto, por
 * petición expresa de los dueños, y se sustituyen por reseñas de verdad al
 * empezar a vender.
 *
 * POR ESO LLEVAN UN AVISO VISIBLE, y no solo este comentario. Un testimonio
 * inventado presentado como auténtico es publicidad engañosa: alguien decide
 * comprar creyendo que otras personas ya lo hicieron. Con el rótulo de
 * "ejemplo" la sección enseña el diseño sin afirmar nada falso, que es
 * exactamente lo que hace falta para defender el proyecto.
 *
 * QUÉ QUITAR CUANDO HAYA RESEÑAS REALES: este archivo entero. La versión
 * definitiva las leerá de la base de datos, con su tabla, su endpoint y su
 * moderación desde el panel — es un módulo, no un retoque.
 */

interface Resena {
  texto: string;
  autor: string;
  ciudad: string;
  estrellas: number;
}

const RESENAS: Resena[] = [
  {
    texto:
      "La macha de cacahuate tiene el tueste justo: sabe a chile, no a aceite quemado. Se me acabó en dos semanas.",
    autor: "Ana P.",
    ciudad: "Guadalajara",
    estrellas: 5,
  },
  {
    texto:
      "Pedí el aceite de ajo rostizado esperando algo discreto y terminé usándolo en todo. El pan con eso es otra cosa.",
    autor: "Miguel R.",
    ciudad: "Ciudad de México",
    estrellas: 5,
  },
  {
    texto:
      "Llegó bien empacado y a los tres días. La de habanero pica de verdad, avisados quedan.",
    autor: "Fernanda L.",
    ciudad: "Monterrey",
    estrellas: 4,
  },
  {
    texto:
      "Compré las tres machas para regalar y me quedé con una. Se nota que están hechas en tandas chicas.",
    autor: "Diego M.",
    ciudad: "Zapopan",
    estrellas: 5,
  },
  {
    texto:
      "El molcajete es pesado y bien labrado, nada que ver con los de tienda de departamento.",
    autor: "Carmen S.",
    ciudad: "Puebla",
    estrellas: 5,
  },
];

export function Resenas(): ReactElement {
  return (
    <section className="border-t border-border-subtle py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Revelar>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl text-ink-900">Lo que dicen</h2>
            {/* El aviso va ARRIBA y a la vista, no en letra pequeña al final:
                enterrarlo sería cumplir la forma y no el fondo. */}
            <span className="rounded-full border border-border-strong px-3 py-1 text-xs tracking-wide text-ink-500 uppercase">
              Contenido de ejemplo
            </span>
          </div>
          <p className="mb-10 max-w-prose text-ink-500">
            Reseñas de muestra para enseñar el diseño. Todavía no hemos vendido, así que
            aquí no hay clientes reales — se sustituirán por los suyos en cuanto los haya.
          </p>
        </Revelar>

        <Revelar retraso={80}>
          <Carrusel etiqueta="Reseñas de ejemplo">
            {RESENAS.map((resena) => (
              <article
                key={resena.autor}
                className="flex w-[19rem] shrink-0 snap-start flex-col justify-between gap-6 rounded-lg border border-border-subtle bg-surface p-6 sm:w-[22rem]"
              >
                <div>
                  <Estrellas cantidad={resena.estrellas} />
                  <p className="mt-4 text-ink-700">“{resena.texto}”</p>
                </div>
                <footer className="text-sm text-ink-500">
                  {resena.autor} · {resena.ciudad}
                </footer>
              </article>
            ))}
          </Carrusel>
        </Revelar>
      </div>
    </section>
  );
}

function Estrellas({ cantidad }: { cantidad: number }): ReactElement {
  return (
    <div className="flex gap-0.5 text-brand-600">
      {/* El texto para lector de pantalla dice el número; las estrellas van
          ocultas. Cinco iconos seguidos se leerían como "estrella estrella
          estrella…", que no informa de nada. */}
      <span className="sr-only">{cantidad} de 5 estrellas</span>
      {Array.from({ length: 5 }, (_, indice) => (
        <svg
          key={indice}
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4"
          fill={indice < cantidad ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z" />
        </svg>
      ))}
    </div>
  );
}
