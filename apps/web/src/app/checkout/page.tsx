import { amountUntilFreeShipping, calculateTotals, formatMoney } from "@bodegon/shared";
import { Button, Card, EmptyState } from "@bodegon/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Header } from "../../components/header";
import { getCartServer } from "../../lib/api";
import { Footer } from "../../components/footer";
import { FormularioDeCheckout } from "./formulario";

export const metadata: Metadata = {
  title: "Finalizar compra",
  // Ninguna pantalla del proceso de compra debe acabar en un buscador.
  robots: { index: false, follow: false },
};

/**
 * Pantalla de checkout.
 *
 * Los importes que se muestran aquí se calculan con `calculateTotals`, la misma
 * función que usa la API para congelar el pedido. Por eso vive en
 * `@bodegon/shared`: si esta pantalla tuviera su propia fórmula, el día que una
 * de las dos cambiara el cliente vería un total y se le cobraría otro.
 *
 * Aun así, esto es solo una previsualización. El importe real lo recalcula el
 * servidor al crear el pedido, leyendo los precios de la base.
 */
export default async function CheckoutPage(): Promise<ReactElement> {
  const carrito = await getCartServer();

  if (carrito.lines.length === 0) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <Card className="p-0">
            <EmptyState
              title="No hay nada que pagar"
              description="Tu carrito está vacío. Elige algunos productos y vuelve por aquí."
              action={
                <Link href="/productos">
                  <Button>Ver catálogo</Button>
                </Link>
              }
            />
          </Card>
        </main>
        <Footer />
      </>
    );
  }

  const totales = calculateTotals(carrito.lines);
  const faltaParaEnvioGratis = amountUntilFreeShipping(carrito.subtotalCents);

  return (
    <>
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 font-display text-3xl text-ink-900">Finalizar compra</h1>

        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <FormularioDeCheckout />

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card>
              <h2 className="font-display text-3xl text-ink-900">Tu pedido</h2>

              <ul className="mt-4 flex flex-col gap-3 border-b border-border-subtle pb-4">
                {carrito.lines.map((linea) => (
                  <li key={linea.id} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 text-ink-700">
                      {linea.productName}
                      <span className="text-ink-500">
                        {" "}
                        · {linea.size} × {linea.quantity}
                      </span>
                    </span>
                    <span className="shrink-0 text-ink-900">
                      {linea.lineTotalFormatted}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-700">Subtotal</dt>
                  <dd className="text-ink-900">{formatMoney(totales.subtotalCents)}</dd>
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

              <div className="mt-4 flex items-baseline justify-between border-t border-border-subtle pt-4">
                <span className="text-ink-900">Total</span>
                <span className="text-2xl font-medium text-ink-900 tabular-nums">
                  {formatMoney(totales.totalCents)}
                </span>
              </div>

              {/* En México el precio mostrado ya incluye IVA: no se suma, se
                  desglosa. Decirlo evita la duda de "¿me van a cobrar 16% más
                  al final?", que es motivo real de abandono del carrito. */}
              <p className="mt-1 text-right text-sm text-ink-500">
                IVA incluido: {formatMoney(totales.taxCents)}
              </p>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}
