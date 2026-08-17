import { Revelar } from "@bodegon/ui";
import { FREE_SHIPPING_THRESHOLD_CENTS, formatMoney } from "@bodegon/shared";
import type { ReactElement } from "react";

/**
 * Puntos clave del producto.
 *
 * Va después de los niveles: primero se resuelve la duda que frena la compra
 * (cuánto pica) y luego se dan las razones para hacerla.
 *
 * TODO LO QUE SE AFIRMA AQUÍ SALE DE `docs/06-contenido-del-sitio.md`, escrito
 * por los dueños. Las 168 horas, los 3 años de caducidad, los 6 meses en frío y
 * el "sin conservadores" son datos suyos, no adornos. El umbral de envío
 * gratis se lee de la misma constante con la que cobra el checkout, así que no
 * puede desincronizarse.
 *
 * Cifras concretas y no adjetivos: "reposan 168 horas" convence, "cuidamos cada
 * detalle" no dice nada y lo escribe cualquiera.
 */

interface Punto {
  cifra: string;
  titulo: string;
  texto: string;
}

const PUNTOS: Punto[] = [
  {
    cifra: "168 h",
    titulo: "de infusión en frío",
    texto:
      "Una semana entera de reposo para nuestros aceites. Es lo que extrae el sabor sin cocerlo.",
  },
  {
    cifra: "0",
    titulo: "conservadores",
    texto:
      "Nada que alargue la vida artificialmente. Por eso, una vez abierto, va al refrigerador.",
  },
  {
    cifra: "3 años",
    titulo: "cerrado",
    texto:
      "Sin abrir aguanta tres años en la alacena. Abierto, hasta seis meses en frío.",
  },
  {
    cifra: "2020",
    titulo: "probando recetas",
    texto: "Empezamos a trabajarlas en 2020 y producimos desde 2021, en tandas pequeñas.",
  },
];

export function PuntosClave(): ReactElement {
  return (
    <section className="border-t border-border-subtle bg-surface/40 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Revelar>
          <h2 className="max-w-2xl font-display text-5xl text-ink-900">
            Lo que hay dentro del frasco
          </h2>
        </Revelar>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PUNTOS.map((punto, indice) => (
            <Revelar as="li" key={punto.titulo} retraso={indice * 70}>
              <article className="flex h-full flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-6">
                <p className="text-4xl font-medium text-brand-600 tabular-nums">
                  {punto.cifra}
                </p>
                <h3 className="text-lg font-medium text-ink-900">{punto.titulo}</h3>
                <p className="text-sm text-ink-700">{punto.texto}</p>
              </article>
            </Revelar>
          ))}
        </ul>

        <Revelar retraso={300}>
          <p className="mt-8 text-ink-500">
            Envío gratis a partir de {formatMoney(FREE_SHIPPING_THRESHOLD_CENTS)} · A todo
            México con DHL
          </p>
        </Revelar>
      </div>
    </section>
  );
}
