import { CarruselArco, Revelar } from "@bodegon/ui";
import type { ReactElement } from "react";

/**
 * "Por qué nuestra salsa": el proceso, en tarjetas sobre un arco.
 *
 * Va después de los puntos clave. Los puntos dan las cifras; esto cuenta cómo
 * se llega a ellas, que es lo que separa "otra salsa artesanal" de una con
 * método.
 *
 * SOBRE UN ARCO y no en fila recta porque son cuatro pasos de un proceso: la
 * curva los lee como una secuencia con principio y final, mientras que una fila
 * recta se lee como cuatro cosas sin orden. El componente calcula la caída y el
 * giro de cada tarjeta en el servidor; no hay JavaScript de por medio.
 *
 * Todo lo que se afirma sale de `docs/06-contenido-del-sitio.md`.
 */

interface Paso {
  numero: string;
  titulo: string;
  texto: string;
}

const PASOS: Paso[] = [
  {
    numero: "01",
    titulo: "El chile primero",
    texto:
      "De primera calidad, sin excepción. Es de donde salen las notas tostadas y el color brillante — con materia prima mediana no hay técnica que lo consiga.",
  },
  {
    numero: "02",
    titulo: "Tostado en comal",
    texto:
      "Uno a uno, hasta el punto justo. Un grado de más y el chile amarga; uno de menos y no despierta.",
  },
  {
    numero: "03",
    titulo: "Reposo en frío",
    texto:
      "Hasta 168 horas de infusión. El calor sería más rápido y arruinaría lo que estamos extrayendo.",
  },
  {
    numero: "04",
    titulo: "Tandas pequeñas",
    texto:
      "Cada lote se cuida por separado. Es lo que permite que la calidad sea la misma en cada gota.",
  },
];

export function PorQue(): ReactElement {
  return (
    <section className="overflow-hidden border-t border-border-subtle py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Revelar>
          <p className="text-sm tracking-widest text-brand-700 uppercase">El proceso</p>
          <h2 className="mt-3 max-w-2xl font-display text-5xl text-ink-900">
            Por qué sabe distinto
          </h2>
          <p className="mt-5 max-w-prose text-lg text-ink-700">
            No hay atajo que dé este resultado. Son cuatro decisiones, y todas cuestan
            tiempo.
          </p>
        </Revelar>

        <Revelar retraso={110}>
          <CarruselArco className="mt-16" caida={72} giro={6}>
            {PASOS.map((paso) => (
              <article
                key={paso.numero}
                className="flex h-full flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-6"
              >
                <p className="font-display text-4xl text-brand-600">{paso.numero}</p>
                <h3 className="text-lg font-medium text-ink-900">{paso.titulo}</h3>
                <p className="text-sm text-ink-700">{paso.texto}</p>
              </article>
            ))}
          </CarruselArco>
        </Revelar>
      </div>
    </section>
  );
}
