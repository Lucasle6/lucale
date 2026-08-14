"use client";

import { Badge, Button } from "@bodegon/ui";
import { urlDeImagen } from "@bodegon/shared";
import type { CartLine } from "@bodegon/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useState } from "react";
import { updateCartItem } from "../../lib/cart-client";

/**
 * Líneas del carrito, con sus controles de cantidad.
 *
 * Los importes NO se recalculan aquí: llegan ya calculados desde el servidor y
 * se vuelven a pedir tras cada cambio. Calcular el total en el navegador
 * invitaría a que alguien lo manipulara, y además duplicaría una lógica que
 * ya existe.
 */
export function LineasDelCarrito({
  lineas,
  imagenBase,
}: {
  lineas: CartLine[];
  imagenBase: string;
}): ReactElement {
  const router = useRouter();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cambiar(itemId: string, cantidad: number): void {
    setError(null);
    setOcupada(itemId);

    void updateCartItem(itemId, cantidad)
      .then(() => {
        // Se vuelve a renderizar en el servidor con los totales recalculados
        // allí. El navegador nunca los suma por su cuenta.
        router.refresh();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "No se pudo actualizar");
      })
      .finally(() => {
        setOcupada(null);
      });
  }

  return (
    <div className="flex flex-col gap-3">
      {error !== null ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {lineas.map((linea) => (
          <li
            key={linea.id}
            className="flex gap-4 rounded-lg border border-border-subtle bg-surface-raised p-4"
          >
            <Miniatura linea={linea} base={imagenBase} />

            <div className="min-w-0 flex-1">
              <Link
                href={`/productos/${linea.productSlug}`}
                className="font-display text-lg text-ink-900 hover:underline"
              >
                {linea.productName}
              </Link>
              <p className="text-sm text-ink-500">
                {linea.size} · {linea.unitPriceFormatted} c/u
              </p>

              {linea.exceedsStock ? (
                <div className="mt-2">
                  <Badge tone="warning">Solo quedan {linea.availableStock}</Badge>
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <ControlCantidad
                  linea={linea}
                  ocupada={ocupada === linea.id}
                  onCambio={cambiar}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={ocupada === linea.id}
                  onClick={() => {
                    cambiar(linea.id, 0);
                  }}
                >
                  Quitar
                </Button>
              </div>
            </div>

            <p className="shrink-0 font-medium text-ink-900">
              {linea.lineTotalFormatted}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ControlCantidad({
  linea,
  ocupada,
  onCambio,
}: {
  linea: CartLine;
  ocupada: boolean;
  onCambio: (itemId: string, cantidad: number) => void;
}): ReactElement {
  return (
    <div className="flex items-center rounded-md border border-border-strong">
      <button
        type="button"
        disabled={ocupada || linea.quantity <= 1}
        onClick={() => {
          onCambio(linea.id, linea.quantity - 1);
        }}
        // Sin aria-label, un lector de pantalla solo diría "menos".
        aria-label={`Quitar una unidad de ${linea.productName} ${linea.size}`}
        className="grid size-8 place-items-center text-ink-700 disabled:opacity-40"
      >
        −
      </button>
      <span
        className="w-8 text-center text-sm text-ink-900"
        aria-live="polite"
        aria-label={`Cantidad: ${String(linea.quantity)}`}
      >
        {linea.quantity}
      </span>
      <button
        type="button"
        disabled={ocupada || linea.quantity >= linea.availableStock}
        onClick={() => {
          onCambio(linea.id, linea.quantity + 1);
        }}
        aria-label={`Añadir una unidad de ${linea.productName} ${linea.size}`}
        className="grid size-8 place-items-center text-ink-700 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function Miniatura({ linea, base }: { linea: CartLine; base: string }): ReactElement {
  if (linea.imageUrl === null) {
    return <div className="size-20 shrink-0 rounded-md bg-surface" aria-hidden="true" />;
  }
  return (
    <img
      src={urlDeImagen(base, linea.imageUrl)}
      alt={linea.productName}
      className="size-20 shrink-0 rounded-md object-cover"
    />
  );
}
