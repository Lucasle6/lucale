import { Button, Card } from "@bodegon/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Header } from "../../../components/header";
import { Footer } from "../../page";

export const metadata: Metadata = {
  title: "Pago cancelado",
  robots: { index: false, follow: false },
};

/**
 * Pantalla de vuelta cuando alguien abandona la pantalla de pago.
 *
 * El tono es deliberadamente tranquilo. Quien llega aquí dudó, y el reflejo de
 * muchas tiendas es presionar ("¡tu carrito expira en 10:00!"). No hacemos eso:
 * su carrito sigue intacto, se lo decimos, y le dejamos volver cuando quiera.
 */
export default function CheckoutCanceladoPage(): ReactElement {
  return (
    <>
      <Header />

      <main className="mx-auto max-w-2xl px-6 py-20">
        <Card className="text-center">
          <h1 className="font-display text-3xl text-ink-900">No se completó el pago</h1>

          <p className="mt-4 text-ink-700">
            No te preocupes: no se te ha cobrado nada y tu carrito sigue tal como lo
            dejaste.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/checkout">
              <Button>Volver a intentarlo</Button>
            </Link>
            <Link href="/carrito">
              <Button variant="secondary">Revisar mi carrito</Button>
            </Link>
          </div>
        </Card>
      </main>

      <Footer />
    </>
  );
}
