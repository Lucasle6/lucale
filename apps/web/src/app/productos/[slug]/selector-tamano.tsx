"use client";

import { Badge, Button } from "@bodegon/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useState } from "react";
import { addToCart } from "../../../lib/cart-client";
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
  const router = useRouter();

  // Arranca en la primera con stock; si no hay ninguna, en la primera.
  const inicial = variantes.find((v) => v.inStock) ?? variantes[0];
  const [seleccionadaId, setSeleccionadaId] = useState(inicial?.id ?? "");

  const [agregando, setAgregando] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function agregar(variantId: string): void {
    setError(null);
    setAgregado(false);
    setAgregando(true);

    void addToCart(variantId, 1)
      .then(() => {
        setAgregado(true);
        // Refresca los Server Components para que el contador de la cabecera
        // muestre el número nuevo.
        router.refresh();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "No se pudo agregar al carrito");
      })
      .finally(() => {
        setAgregando(false);
      });
  }

  const seleccionada = variantes.find((v) => v.id === seleccionadaId) ?? variantes[0];

  if (seleccionada === undefined) {
    return <p className="text-ink-500">Este producto no tiene variantes disponibles.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {variantes.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-700">Presentación</legend>
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

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          disabled={!seleccionada.inStock}
          isLoading={agregando}
          onClick={() => {
            agregar(seleccionada.id);
          }}
        >
          {seleccionada.inStock ? "Agregar al carrito" : "Sin existencias"}
        </Button>

        {error !== null ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {agregado ? (
          // role="status" y no "alert": es una confirmación, no un problema.
          // El lector de pantalla lo anuncia sin interrumpir lo que se esté
          // leyendo.
          <p role="status" className="flex items-center gap-2 text-sm text-sage-700">
            Añadido a tu carrito.{" "}
            <Link href="/carrito" className="underline">
              Verlo
            </Link>
          </p>
        ) : null}
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
