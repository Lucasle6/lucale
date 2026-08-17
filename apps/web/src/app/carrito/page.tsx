import { amountUntilFreeShipping, calculateTotals, formatMoney } from "@bodegon/shared";
import { Button, Card, EmptyState } from "@bodegon/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../../components/footer";
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

  // Las mismas funciones que usa la API para congelar el pedido. Una sola
  // fórmula para el envío y el IVA, viva en `@bodegon/shared`.
  //
  // Se le pasan las LÍNEAS, no el subtotal: cada producto trae su propia tasa
  // (0% los alimentos, 16% los utensilios) y el impuesto se suma línea a línea.
  const totales = calculateTotals(carrito.lines);
  const faltaParaEnvioGratis = amountUntilFreeShipping(carrito.subtotalCents);

  return (
    <>
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-8 font-display text-3xl text-ink-900">Tu carrito</h1>

        {carrito.lines.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="Tu carrito está vacío"
              description="Cuando agregues productos aparecerán aquí. Empieza por el catálogo."
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
                <h2 className="font-display text-3xl text-ink-900">Resumen</h2>

                <dl className="mt-4 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-700">
                      Subtotal ({carrito.itemCount}{" "}
                      {carrito.itemCount === 1 ? "producto" : "productos"})
                    </dt>
                    <dd className="text-ink-900">{carrito.subtotalFormatted}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-700">Envío</dt>
                    <dd className="text-ink-900">
                      {totales.shippingCents === 0
                        ? "Gratis"
                        : formatMoney(totales.shippingCents)}
                    </dd>
                  </div>
                </dl>

                {faltaParaEnvioGratis > 0 ? (
                  <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
                    Te faltan {formatMoney(faltaParaEnvioGratis)} para el envío gratis.
                  </p>
                ) : null}

                <div className="mt-4 flex justify-between border-t border-border-subtle pt-4">
                  <span className="text-ink-900">Total</span>
                  <span className="text-2xl font-medium text-ink-900 tabular-nums">
                    {formatMoney(totales.totalCents)}
                  </span>
                </div>

                <p className="mt-1 text-right text-sm text-ink-500">
                  IVA incluido: {formatMoney(totales.taxCents)}
                </p>

                {carrito.hasIssues ? (
                  <p role="alert" className="mt-4 text-sm text-danger">
                    Algunos productos superan el stock disponible. Ajusta las cantidades
                    antes de continuar.
                  </p>
                ) : null}

                <div className="mt-5">
                  {/* Si alguna línea se pasa del inventario no se deja avanzar:
                      la API lo rechazaría igualmente, y es mejor decirlo aquí
                      que dejar que descubra el problema a mitad del pago. */}
                  {carrito.hasIssues ? (
                    <Button fullWidth size="lg" disabled>
                      Pagar
                    </Button>
                  ) : (
                    <Link href="/checkout" className="block">
                      <Button fullWidth size="lg">
                        Pagar
                      </Button>
                    </Link>
                  )}
                  <p className="mt-2 text-center text-sm text-ink-500">
                    Pago seguro con tarjeta. Los datos los procesa Stripe.
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
