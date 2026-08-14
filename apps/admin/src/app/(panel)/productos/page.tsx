import { Badge, Button, Card, EmptyState } from "@bodegon/ui";
import { urlDeImagen } from "@bodegon/shared";
import Link from "next/link";
import type { ReactElement } from "react";
import { apiServer } from "../../../lib/api-server";
import { FILES_URL } from "../../../lib/api";

export const metadata = { title: "Productos" };

interface ProductoAdmin {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryName: string | null;
  totalStock: number;
  variants: { id: string; size: string; priceFormatted: string; stock: number }[];
  images: { url: string }[];
  updatedAt: string;
}

/**
 * Listado de productos.
 *
 * Es un Server Component: la petición a la API ocurre en el servidor de Next y
 * al navegador solo llega HTML ya renderizado. Ni una línea de la lógica de
 * consulta viaja al cliente.
 */
export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}): Promise<ReactElement> {
  const params = await searchParams;

  const query = new URLSearchParams({ limit: "50" });
  if (params.q !== undefined && params.q !== "") query.set("search", params.q);
  if (params.status !== undefined && params.status !== "") {
    query.set("status", params.status);
  }

  const { items } = await apiServer<{ items: ProductoAdmin[] }>(
    `/admin/products?${query.toString()}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-ink-900">Productos</h1>
          <p className="mt-1 text-ink-500">
            {items.length === 1 ? "1 producto" : `${String(items.length)} productos`} · el
            panel ve también los borradores
          </p>
        </div>
        <Link href="/productos/nuevo">
          <Button>Nuevo producto</Button>
        </Link>
      </header>

      <Filtros activo={params.status ?? ""} busqueda={params.q ?? ""} />

      {items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No hay productos que coincidan"
            description="Prueba a quitar los filtros o crea el primero."
            action={
              <Link href="/productos/nuevo">
                <Button>Crear producto</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((producto) => (
            <FilaProducto key={producto.id} producto={producto} />
          ))}
        </div>
      )}
    </div>
  );
}

function Filtros({
  activo,
  busqueda,
}: {
  activo: string;
  busqueda: string;
}): ReactElement {
  const opciones = [
    { valor: "", etiqueta: "Todos" },
    { valor: "DRAFT", etiqueta: "Borradores" },
    { valor: "ACTIVE", etiqueta: "Publicados" },
    { valor: "ARCHIVED", etiqueta: "Archivados" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Formulario HTML normal: navega a la misma página con otros parámetros.
          No necesita JavaScript, así que funciona incluso si el bundle falla. */}
      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar productos"
          className="h-9 w-64 rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-ink-900 placeholder:text-ink-500"
        />
        {activo !== "" ? <input type="hidden" name="status" value={activo} /> : null}
        <Button type="submit" variant="secondary" size="sm">
          Buscar
        </Button>
      </form>

      <div className="flex flex-wrap gap-1">
        {opciones.map((opcion) => {
          const query = new URLSearchParams();
          if (busqueda !== "") query.set("q", busqueda);
          if (opcion.valor !== "") query.set("status", opcion.valor);
          const href = `/productos${query.toString() === "" ? "" : `?${query.toString()}`}`;

          return (
            <Link
              key={opcion.valor}
              href={href}
              aria-current={activo === opcion.valor ? "page" : undefined}
              className={
                activo === opcion.valor
                  ? "rounded-full bg-brand-600 px-3 py-1 text-sm font-medium text-white"
                  : "rounded-full px-3 py-1 text-sm text-ink-700 hover:bg-brand-50"
              }
            >
              {opcion.etiqueta}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const TONO_POR_ESTADO = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "warning",
} as const;

const ETIQUETA_POR_ESTADO = {
  DRAFT: "Borrador",
  ACTIVE: "Publicado",
  ARCHIVED: "Archivado",
} as const;

function FilaProducto({ producto }: { producto: ProductoAdmin }): ReactElement {
  const primera = producto.variants[0];

  return (
    <Card interactive className="p-4">
      <Link href={`/productos/${producto.id}`} className="flex items-center gap-4">
        <Miniatura url={producto.images[0]?.url} nombre={producto.name} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg text-ink-900">{producto.name}</h2>
            <Badge tone={TONO_POR_ESTADO[producto.status]}>
              {ETIQUETA_POR_ESTADO[producto.status]}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-500">
            {producto.categoryName ?? "Sin categoría"} ·{" "}
            {producto.variants.length === 1
              ? "1 variante"
              : `${String(producto.variants.length)} variantes`}
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-ink-900">{primera?.priceFormatted ?? "—"}</p>
          <p className="text-sm text-ink-500">
            {producto.totalStock === 0
              ? "sin stock"
              : `${String(producto.totalStock)} en stock`}
          </p>
        </div>
      </Link>
    </Card>
  );
}

function Miniatura({
  url,
  nombre,
}: {
  url: string | undefined;
  nombre: string;
}): ReactElement {
  if (url === undefined) {
    return (
      <div
        className="grid size-14 shrink-0 place-items-center rounded-md bg-surface text-ink-500"
        aria-hidden="true"
      >
        <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M18 9h.008M2.25 19.5V4.5A2.25 2.25 0 0 1 4.5 2.25h15A2.25 2.25 0 0 1 21.75 4.5v15a2.25 2.25 0 0 1-2.25 2.25h-15A2.25 2.25 0 0 1 2.25 19.5Z"
          />
        </svg>
      </div>
    );
  }

  return (
    // <img> y no next/image: la optimización de Next necesita el dominio de
    // origen declarado en la configuración, y aquí conviven dos —la API en
    // desarrollo y el almacén de objetos en producción—. No compensa por una
    // miniatura de 56 px.
    //
    // El origen SALE DE urlDeImagen y no se escribe aquí. Estuvo puesto a mano
    // como `http://localhost:4000`, con una nota de "se arregla el Día 15" que
    // nadie volvió a leer: la lista del panel jamás mostró una imagen en
    // producción. No fallaba nada visible desde fuera, así que nadie lo notó.
    <img
      src={urlDeImagen(FILES_URL, url)}
      alt={`Imagen de ${nombre}`}
      className="size-14 shrink-0 rounded-md object-cover"
    />
  );
}
