"use client";

import { Badge, Button, Card, Input, Select, Textarea } from "@bodegon/ui";
import { fromCents, slugify, toCents } from "@bodegon/shared";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useState } from "react";
import { ApiRequestError, apiClient } from "../../../lib/api";
import { ImagenesDelProducto } from "./imagenes";

/**
 * Formulario de producto, para crear y para editar.
 *
 * Los precios se muestran en pesos ("149.90") pero viajan en centavos enteros
 * (14990): la conversión ocurre aquí, en el borde. Dentro del sistema el
 * dinero nunca es decimal — ver packages/shared/src/money.ts.
 */

interface Variante {
  id?: string;
  size: string;
  sku: string;
  /** Texto mientras se edita: "149.90". Se convierte al enviar. */
  precio: string;
  stock: string;
}

export interface ProductoExistente {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  updatedAt: string;
  variants: {
    id: string;
    size: string;
    sku: string;
    priceCents: number;
    stock: number;
  }[];
  images: { id: string; url: string; alt: string | null }[];
}

export function ProductForm({
  producto,
}: {
  producto?: ProductoExistente;
}): ReactElement {
  const router = useRouter();
  const editando = producto !== undefined;

  const [nombre, setNombre] = useState(producto?.name ?? "");
  const [descripcion, setDescripcion] = useState(producto?.description ?? "");
  const [estado, setEstado] = useState(producto?.status ?? "DRAFT");
  const [variantes, setVariantes] = useState<Variante[]>(
    producto?.variants.map((v) => ({
      id: v.id,
      size: v.size,
      sku: v.sku,
      precio: fromCents(v.priceCents).toFixed(2),
      stock: String(v.stock),
    })) ?? [{ size: "", sku: "", precio: "", stock: "0" }],
  );

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function actualizarVariante(
    indice: number,
    campo: keyof Variante,
    valor: string,
  ): void {
    setVariantes((previas) =>
      previas.map((v, i) => (i === indice ? { ...v, [campo]: valor } : v)),
    );
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setError(null);
    setGuardando(true);

    void (async () => {
      try {
        const variantesConvertidas = variantes.map((v) => ({
          ...(v.id === undefined ? {} : { id: v.id }),
          size: v.size.trim(),
          sku: v.sku.trim().toUpperCase(),
          // Aquí ocurre la conversión: "149.90" → 14990.
          priceCents: toCents(Number(v.precio)),
          stock: Number(v.stock),
        }));

        if (editando) {
          await apiClient(`/admin/products/${producto.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: nombre,
              description: descripcion === "" ? null : descripcion,
              status: estado,
              variants: variantesConvertidas,
              // Bloqueo optimista: si otro admin guardó mientras tanto, la API
              // responde 409 en vez de pisar sus cambios.
              expectedUpdatedAt: producto.updatedAt,
            }),
          });
          router.refresh();
        } else {
          const creado = await apiClient<{ id: string }>("/admin/products", {
            method: "POST",
            body: JSON.stringify({
              name: nombre,
              description: descripcion === "" ? undefined : descripcion,
              status: estado,
              variants: variantesConvertidas,
            }),
          });
          // Tras crear se va a la edición, donde ya se pueden subir imágenes.
          router.replace(`/productos/${creado.id}`);
          router.refresh();
        }
      } catch (e) {
        setError(
          e instanceof ApiRequestError
            ? e.error.message
            : "No se pudo guardar el producto",
        );
      } finally {
        setGuardando(false);
      }
    })();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 text-xl text-ink-900">Información general</h2>
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
            }}
            required
            minLength={2}
            maxLength={160}
          />

          {/* Vista previa del slug: se calcula con la MISMA función que usará
              el servidor, así que lo que se ve aquí es lo que quedará. */}
          {!editando && nombre !== "" ? (
            <p className="text-sm text-ink-500">
              URL: <span className="font-mono">/productos/{slugify(nombre)}</span>
            </p>
          ) : null}
          {editando ? (
            <p className="text-sm text-ink-500">
              URL: <span className="font-mono">/productos/{producto.slug}</span>{" "}
              <span className="text-ink-500">
                — no cambia al editar el nombre, para no romper enlaces
              </span>
            </p>
          ) : null}

          <Textarea
            label="Descripción"
            value={descripcion}
            onChange={(e) => {
              setDescripcion(e.target.value);
            }}
            maxLength={4000}
            hint="Opcional. Se muestra en la ficha del producto."
          />

          <Select
            label="Estado"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as typeof estado);
            }}
            hint="Solo los publicados aparecen en la tienda."
          >
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Publicado</option>
            <option value="ARCHIVED">Archivado</option>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl text-ink-900">Variantes</h2>
            <p className="text-sm text-ink-500">
              Cada tamaño tiene su propio precio y su propio inventario.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setVariantes((v) => [...v, { size: "", sku: "", precio: "", stock: "0" }]);
            }}
          >
            Añadir variante
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {variantes.map((variante, indice) => (
            <div
              key={variante.id ?? `nueva-${String(indice)}`}
              className="grid gap-3 rounded-md border border-border-subtle p-4 sm:grid-cols-4"
            >
              <Input
                label="Tamaño"
                value={variante.size}
                onChange={(e) => {
                  actualizarVariante(indice, "size", e.target.value);
                }}
                required
                placeholder="Pequeña"
              />
              <Input
                label="SKU"
                value={variante.sku}
                onChange={(e) => {
                  actualizarVariante(indice, "sku", e.target.value);
                }}
                required
                placeholder="MAC-HEX-S"
                className="font-mono"
              />
              <Input
                label="Precio (MXN)"
                value={variante.precio}
                onChange={(e) => {
                  actualizarVariante(indice, "precio", e.target.value);
                }}
                required
                inputMode="decimal"
                placeholder="149.90"
              />
              <div className="flex items-end gap-2">
                <Input
                  label="Stock"
                  value={variante.stock}
                  onChange={(e) => {
                    actualizarVariante(indice, "stock", e.target.value);
                  }}
                  required
                  inputMode="numeric"
                  className="flex-1"
                />
                {variantes.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setVariantes((v) => v.filter((_, i) => i !== indice));
                    }}
                    aria-label={`Quitar la variante ${variante.size || String(indice + 1)}`}
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {editando ? (
        <ImagenesDelProducto productoId={producto.id} iniciales={producto.images} />
      ) : (
        <Card>
          <h2 className="text-xl text-ink-900">Imágenes</h2>
          <p className="mt-1 text-ink-500">
            Podrás subirlas en cuanto guardes el producto.
          </p>
        </Card>
      )}

      {error !== null ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={guardando}>
          {editando ? "Guardar cambios" : "Crear producto"}
        </Button>
        {editando ? (
          <Badge tone={estado === "ACTIVE" ? "success" : "neutral"}>
            {estado === "ACTIVE" ? "Visible en la tienda" : "No visible"}
          </Badge>
        ) : null}
      </div>
    </form>
  );
}
