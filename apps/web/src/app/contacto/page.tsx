import { Revelar } from "@bodegon/ui";
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { Footer } from "../page";
import { Header } from "../../components/header";
import { CORREOS, UBICACION, WHATSAPP_EU, WHATSAPP_MX } from "../../lib/contacto";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Escríbenos por WhatsApp o correo. Producción en Zapopan, Jalisco. Recogida en persona sobre acuerdo.",
};

/**
 * Página de contacto.
 *
 * SIN FORMULARIO, y es una decisión, no una carencia. Un formulario necesita
 * enviar correos, y hoy el mailer del proyecto escribe en el log: el mensaje se
 * perdería y el cliente se quedaría creyendo que llegó. Es peor que no tener
 * formulario. Cuando conectemos un proveedor de correo real, se añade aquí.
 *
 * Mientras tanto WhatsApp, que además es como la gente escribe de verdad a una
 * marca pequeña en México.
 */

export default function ContactoPage(): ReactElement {
  return (
    <>
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Revelar>
          <p className="text-sm tracking-widest text-brand-700 uppercase">Contacto</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink-900 sm:text-5xl">
            Escríbenos
          </h1>
          <p className="mt-6 text-lg text-ink-700">
            Somos dos personas, así que contestamos nosotros. Para pedidos, mayoreo o
            dudas sobre un producto, lo más rápido es WhatsApp.
          </p>
        </Revelar>

        <Revelar retraso={90}>
          <section className="mt-12 rounded-lg border border-border-subtle bg-surface p-6">
            <h2 className="font-display text-xl text-ink-900">WhatsApp</h2>
            <p className="mt-1 text-ink-500">{WHATSAPP_MX.visible}</p>

            <div className="mt-5 flex flex-wrap gap-3">
              {/* `rel="noreferrer"` en todo enlace externo con target _blank: sin
                  él, la página destino recibe una referencia a la nuestra y
                  puede redirigirla. */}
              <a
                href={WHATSAPP_MX.enlace}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-brand-600 px-4 py-2 font-medium text-bg transition-colors hover:bg-brand-700"
              >
                Escribir a México
              </a>
              <a
                href={WHATSAPP_EU.enlace}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border-strong px-4 py-2 text-ink-900 transition-colors hover:border-brand-600"
              >
                Escribir a Europa
              </a>
            </div>
          </section>
        </Revelar>

        <Revelar retraso={140}>
          <section className="mt-6 rounded-lg border border-border-subtle bg-surface p-6">
            <h2 className="font-display text-xl text-ink-900">Correo</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {CORREOS.map((correo) => (
                <li key={correo}>
                  <a
                    href={`mailto:${correo}`}
                    className="text-brand-700 underline-offset-4 hover:underline"
                  >
                    {correo}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </Revelar>

        <Revelar retraso={190}>
          <section className="mt-6 rounded-lg border border-border-subtle bg-surface p-6">
            <h2 className="font-display text-xl text-ink-900">Dónde estamos</h2>
            <p className="mt-3 text-ink-700">
              Producimos en{" "}
              <strong className="text-ink-900">
                {UBICACION.ciudad}, {UBICACION.estado}
              </strong>
              . Por ahora no tenemos local abierto al público.
            </p>
            <p className="mt-3 text-ink-700">
              {/* El {" "} explícito no es adorno: JSX descarta el salto de línea
                  entre un texto y una expresión, y sin él sale "enZapopan". */}
              Se puede <strong className="text-ink-900">recoger en persona</strong> en{" "}
              {UBICACION.ciudad}, poniéndonos de acuerdo antes por WhatsApp.
            </p>
          </section>
        </Revelar>

        <Revelar retraso={240}>
          <p className="mt-10 text-sm text-ink-500">
            Enviamos a todo México. Si tu pedido llegó dañado, incompleto o equivocado,
            avísanos dentro de los 7 días siguientes y lo resolvemos.
          </p>
        </Revelar>
      </main>

      <Footer />
    </>
  );
}
