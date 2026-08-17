import { Badge, Card, MarcadorFoto } from "@bodegon/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { imageUrl } from "../lib/api";
import type { ProductSummary } from "../lib/api";

export function ProductCard({ producto }: { producto: ProductSummary }): ReactElement {
  return (
    <Card interactive className="flex h-full flex-col p-0">
      <Link href={`/productos/${producto.slug}`} className="flex h-full flex-col">
        <div className="aspect-square overflow-hidden rounded-t-lg bg-surface">
          {producto.image === null ? (
            <MarcadorFoto semilla={producto.slug} />
          ) : (
            <img
              src={imageUrl(producto.image.url)}
              alt={producto.image.alt ?? producto.name}
              className="size-full object-cover"
              loading="lazy"
            />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-4">
          <h2 className="font-display text-lg text-ink-900">{producto.name}</h2>

          {producto.sizes.length > 0 ? (
            <p className="text-sm text-ink-500">{producto.sizes.join(" · ")}</p>
          ) : null}

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <p className="text-ink-900">
              {producto.sizes.length > 1 ? (
                <span className="text-sm text-ink-500">desde </span>
              ) : null}
              <span className="font-medium">{producto.priceFromFormatted}</span>
            </p>
            {producto.inStock ? null : <Badge tone="warning">Agotado</Badge>}
          </div>
        </div>
      </Link>
    </Card>
  );
}
