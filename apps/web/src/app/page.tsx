import { Button } from "@bodegon/ui";
import Link from "next/link";
import type { ReactElement } from "react";

/**
 * Portada provisional.
 *
 * La tienda de verdad —catálogo, filtros, fichas— se construye el Día 9. Hoy
 * esto solo confirma que la app arranca y que los tokens se aplican.
 */
export default function HomePage(): ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="text-sm font-medium tracking-wide text-brand-600 uppercase">
        Impresión 3D
      </p>
      <h1 className="text-5xl text-ink-900">Bodegón de José</h1>
      <p className="max-w-prose text-lg text-ink-700">
        Piezas para decorar, ordenar y resolver. Hechas con calma, una capa a la vez.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button disabled>Ver catálogo</Button>
        <Link href="/design-system">
          <Button variant="secondary">Design system</Button>
        </Link>
      </div>
      <p className="text-sm text-ink-500">
        El catálogo llega el Día 9. Por ahora, el design system está listo.
      </p>
    </main>
  );
}
