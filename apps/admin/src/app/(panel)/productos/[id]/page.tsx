import { Badge } from "@bodegon/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { apiServer } from "../../../../lib/api-server";
import { ProductForm } from "../product-form";
import type { ProductoExistente } from "../product-form";

export const metadata = { title: "Editar producto" };

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;

  let producto: ProductoExistente;
  try {
    producto = await apiServer<ProductoExistente>(`/admin/products/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/productos" className="text-sm text-brand-700 hover:underline">
          ← Volver a productos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl text-ink-900">{producto.name}</h1>
          {producto.status === "ACTIVE" ? (
            <a
              href={`http://localhost:3000/productos/${producto.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-700 hover:underline"
            >
              Ver en la tienda ↗
            </a>
          ) : (
            <Badge>No visible en la tienda</Badge>
          )}
        </div>
      </div>
      <ProductForm producto={producto} />
    </div>
  );
}
