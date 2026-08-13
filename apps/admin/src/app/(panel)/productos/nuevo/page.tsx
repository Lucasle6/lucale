import Link from "next/link";
import type { ReactElement } from "react";
import { ProductForm } from "../product-form";

export const metadata = { title: "Nuevo producto" };

export default function NuevoProductoPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/productos" className="text-sm text-brand-700 hover:underline">
          ← Volver a productos
        </Link>
        <h1 className="mt-2 text-3xl text-ink-900">Nuevo producto</h1>
        <p className="mt-1 text-ink-500">
          Nace como borrador: puedes armarlo con calma sin que aparezca en la tienda.
        </p>
      </div>
      <ProductForm />
    </div>
  );
}
