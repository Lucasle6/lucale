import { Button, Card } from "@bodegon/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Header } from "../../../components/header";
import { Footer } from "../../page";

export const metadata: Metadata = {
  title: "Gracias por tu compra",
  robots: { index: false, follow: false },
};

/**
 * Forma esperada del número de pedido: LCL-2026-1050.
 *
 * Se comprueba porque este valor viene de la barra de direcciones, y ahí puede
 * escribir cualquiera. React escapa el texto, así que no hay riesgo de
 * inyección — el riesgo es de credibilidad: sin esta comprobación, cualquiera
 * podría abrir `?pedido=lo-que-sea` y llevarse una captura de pantalla de
 * nuestra tienda confirmando un pedido inventado.
 */
const FORMATO_PEDIDO = /^LCL-\d{4}-\d+$/;

export default async function CheckoutExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}): Promise<ReactElement> {
  const { pedido } = await searchParams;
  const numero =
    typeof pedido === "string" && FORMATO_PEDIDO.test(pedido) ? pedido : null;

  return (
    <>
      <Header />

      <main className="mx-auto max-w-2xl px-6 py-20">
        <Card className="text-center">
          <p className="text-sm tracking-widest text-brand-600 uppercase">
            Pago recibido
          </p>

          <h1 className="mt-3 font-display text-3xl text-ink-900">
            Gracias por tu compra
          </h1>

          {/*
            Se dice "estamos confirmando" y no "¡pagado!" a propósito.

            Esta pantalla es solo una redirección del navegador: llegar aquí no
            demuestra que el dinero se haya movido. Quien lo confirma es Stripe,
            hablando con nuestro servidor por su cuenta. Prometer aquí un cobro
            confirmado sería afirmar algo que en este momento no sabemos.
          */}
          <p className="mt-4 text-ink-700">
            Estamos confirmando el pago con el banco. En cuanto quede listo te llega un
            correo con el detalle y el número de guía.
          </p>

          {numero !== null ? (
            <p className="mt-6 text-sm text-ink-500">
              Tu número de pedido es{" "}
              <span className="font-medium text-ink-900">{numero}</span>. Guárdalo por si
              necesitas escribirnos.
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/productos">
              <Button>Seguir viendo piezas</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">Ir al inicio</Button>
            </Link>
          </div>
        </Card>
      </main>

      <Footer />
    </>
  );
}
