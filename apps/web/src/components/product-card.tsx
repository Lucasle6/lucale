import { Badge, Card } from "@bodegon/ui";
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
            <SinImagen />
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

function SinImagen(): ReactElement {
  return (
    <div className="grid size-full place-items-center text-brand-300" aria-hidden="true">
      <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
