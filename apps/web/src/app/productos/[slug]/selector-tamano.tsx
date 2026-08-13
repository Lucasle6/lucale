"use client";

import { Badge, Button } from "@bodegon/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import type { ProductVariant } from "../../../lib/api";

/**
 * Selector de tamaño y precio.
 *
 * Es el único Client Component de la ficha: el resto se renderiza en el
 * servidor. Aquí hay estado (qué tamaño está elegido), así que necesita
 * JavaScript en el navegador.
 *
 * Se implementa como grupo de radios y no como botones sueltos: un lector de
 * pantalla anuncia "opción 2 de 3", y las flechas del teclado permiten
 * recorrer las opciones. Con botones habría que reconstruir todo eso a mano.
 */
export function SelectorTamano({
  variantes,
}: {
  variantes: ProductVariant[];
}): ReactElement {
  // Arranca en la primera con stock; si no hay ninguna, en la primera.
  const inicial = variantes.find((v) => v.inStock) ?? variantes[0];
  const [seleccionadaId, setSeleccionadaId] = useState(inicial?.id ?? "");

  const seleccionada = variantes.find((v) => v.id === seleccionadaId) ?? variantes[0];

  if (seleccionada === undefined) {
    return <p className="text-ink-500">Este producto no tiene variantes disponibles.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {variantes.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-700">Tamaño</legend>
          <div className="flex flex-wrap gap-2">
            {variantes.map((variante) => (
              <label
                key={variante.id}
                className={etiquetaDeOpcion(
                  variante.id === seleccionadaId,
                  variante.inStock,
                )}
              >
                <input
                  type="radio"
                  name="tamano"
                  value={variante.id}
                  checked={variante.id === seleccionadaId}
                  onChange={() => {
                    setSeleccionadaId(variante.id);
                  }}
                  disabled={!variante.inStock}
                  className="sr-only"
                />
                <span>{variante.size}</span>
                {variante.inStock ? null : <span className="text-xs"> · agotado</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-baseline gap-3">
        <p className="font-display text-3xl text-ink-900">
          {seleccionada.priceFormatted}
        </p>
        {seleccionada.inStock ? (
          <Badge tone="success">En stock</Badge>
        ) : (
          <Badge tone="warning">Agotado</Badge>
        )}
      </div>

      <div>
        {/* El carrito llega el Día 10; hoy el botón queda anunciado pero
            inactivo, en vez de fingir que funciona. */}
        <Button size="lg" disabled>
          {seleccionada.inStock ? "Agregar al carrito" : "Sin existencias"}
        </Button>
        <p className="mt-2 text-sm text-ink-500">El carrito se activa muy pronto.</p>
      </div>

      <dl className="border-t border-border-subtle pt-4 text-sm">
        <div className="flex gap-2">
          <dt className="text-ink-500">Código</dt>
          <dd className="font-mono text-ink-700">{seleccionada.sku}</dd>
        </div>
      </dl>
    </div>
  );
}

function etiquetaDeOpcion(seleccionada: boolean, disponible: boolean): string {
  const base =
    "cursor-pointer rounded-md border px-4 py-2 text-sm transition-colors " +
    // El foco se muestra sobre la etiqueta cuando el radio oculto lo recibe.
    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700";

  if (!disponible) {
    return `${base} cursor-not-allowed border-border-subtle text-ink-500 line-through`;
  }
  if (seleccionada) {
    return `${base} border-brand-600 bg-brand-600 text-white`;
  }
  return `${base} border-border-strong text-ink-900 hover:border-brand-400`;
}
