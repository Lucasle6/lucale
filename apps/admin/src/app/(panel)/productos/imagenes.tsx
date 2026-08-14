"use client";

import { Button, Card } from "@bodegon/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { urlDeImagen } from "@bodegon/shared";
import { ApiRequestError, FILES_URL, apiClient } from "../../../lib/api";

interface Imagen {
  id: string;
  url: string;
  alt: string | null;
}

/** Base sin el sufijo /v1, para componer las URLs de los archivos servidos. */
const BASE_ARCHIVOS = FILES_URL;

/**
 * Galería del producto: subir y eliminar imágenes.
 *
 * La validación de verdad ocurre en el servidor (magic bytes + reprocesado).
 * El `accept` del input es solo comodidad: filtra el diálogo del sistema, pero
 * cualquiera puede seleccionar otra cosa o llamar a la API directamente.
 */
export function ImagenesDelProducto({
  productoId,
  iniciales,
}: {
  productoId: string;
  iniciales: Imagen[];
}): ReactElement {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imagenes, setImagenes] = useState<Imagen[]>(iniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function subir(evento: React.ChangeEvent<HTMLInputElement>): void {
    const archivo = evento.target.files?.[0];
    if (archivo === undefined) return;

    setError(null);
    setSubiendo(true);

    const formulario = new FormData();
    formulario.append("file", archivo);
    formulario.append("alt", "");

    void apiClient<Imagen>(`/admin/products/${productoId}/images`, {
      method: "POST",
      body: formulario,
    })
      .then((nueva) => {
        setImagenes((previas) => [...previas, { ...nueva, alt: null }]);
        router.refresh();
      })
      .catch((e: unknown) => {
        // Aquí es donde aparece "el archivo no es una imagen válida" cuando
        // alguien intenta subir algo que solo finge serlo.
        setError(
          e instanceof ApiRequestError ? e.error.message : "No se pudo subir la imagen",
        );
      })
      .finally(() => {
        setSubiendo(false);
        // Se limpia el input para poder volver a elegir el mismo archivo.
        if (inputRef.current !== null) inputRef.current.value = "";
      });
  }

  function eliminar(imagenId: string): void {
    void apiClient(`/admin/products/${productoId}/images/${imagenId}`, {
      method: "DELETE",
    })
      .then(() => {
        setImagenes((previas) => previas.filter((i) => i.id !== imagenId));
        router.refresh();
      })
      .catch(() => {
        setError("No se pudo eliminar la imagen");
      });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl text-ink-900">Imágenes</h2>
          <p className="text-sm text-ink-500">
            Se normalizan a WebP y se les borran los metadatos EXIF.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={subir}
            className="sr-only"
            id="subir-imagen"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            Subir imagen
          </Button>
        </div>
      </div>

      {error !== null ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {imagenes.length === 0 ? (
        <p className="text-ink-500">Este producto todavía no tiene imágenes.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {imagenes.map((imagen) => (
            <li key={imagen.id} className="group relative">
              {/* <img> y no next/image a propósito: la optimización de Next
                  necesita saber el dominio de origen, y ese se define el Día 15
                  al configurar R2. */}
              <img
                src={urlDeImagen(BASE_ARCHIVOS, imagen.url)}
                alt={imagen.alt ?? "Imagen del producto"}
                className="aspect-square w-full rounded-md border border-border-subtle object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  eliminar(imagen.id);
                }}
                className="absolute top-1 right-1 rounded-md bg-surface-raised/90 px-2 py-1 text-xs text-danger opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
