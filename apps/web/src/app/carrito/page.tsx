import { Button, Card, EmptyState } from "@bodegon/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../page";
import { Header } from "../../components/header";
import { FILES_URL, getCartServer } from "../../lib/api";
import { LineasDelCarrito } from "./lineas";

export const metadata: Metadata = {
  title: "Tu carrito",
  // El carrito es personal: no tiene sentido que un buscador lo indexe.
  robots: { index: false, follow: true },
};

/**
 * El carrito se renderiza en el servidor y NO se cachea.
 *
 * Los totales llegan ya calculados desde la API, que los obtiene de la base de
 * datos. El navegador nunca suma nada: solo muestra.
 */
export default async function CarritoPage(): Promise<ReactElement> {
  const carrito = await getCartServer();

  return (
    <>
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-8 font-display text-3xl text-ink-900">Tu carrito</h1>

        {carrito.lines.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="Tu carrito está vacío"
              description="Cuando agregues piezas aparecerán aquí. Empieza por el catálogo."
              action={
                <Link href="/productos">
                  <Button>Ver catálogo</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <LineasDelCarrito lineas={carrito.lines} imagenBase={FILES_URL} />

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <Card>
                <h2 className="font-display text-xl text-ink-900">Resumen</h2>

                <dl className="mt-4 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-700">
                      Subtotal ({carrito.itemCount}{" "}
                      {carrito.itemCount === 1 ? "pieza" : "piezas"})
                    </dt>
                    <dd className="text-ink-900">{carrito.subtotalFormatted}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-700">Envío</dt>
                    <dd className="text-ink-500">Se calcula al pagar</dd>
                  </div>
                </dl>

                <div className="mt-4 flex justify-between border-t border-border-subtle pt-4">
                  <span className="text-ink-900">Total</span>
                  <span className="font-display text-2xl text-ink-900">
                    {carrito.subtotalFormatted}
                  </span>
                </div>

                {carrito.hasIssues ? (
                  <p role="alert" className="mt-4 text-sm text-danger">
                    Algunas piezas superan el stock disponible. Ajusta las cantidades
                    antes de continuar.
                  </p>
                ) : null}

                <div className="mt-5">
                  {/* El pago llega el Día 11. Se anuncia en vez de fingir que
                      funciona. */}
                  <Button fullWidth size="lg" disabled>
                    Pagar
                  </Button>
                  <p className="mt-2 text-center text-sm text-ink-500">
                    El pago con tarjeta se activa muy pronto.
                  </p>
                </div>
              </Card>
            </aside>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
