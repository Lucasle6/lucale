import { Revelar } from "@bodegon/ui";
import {
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  formatMoney,
} from "@bodegon/shared";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../../components/footer";
import { Header } from "../../components/header";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description:
    "Envíos a todo México, caducidad, pagos, cambios y devoluciones. Todo lo que suelen preguntarnos antes de comprar.",
};

/**
 * Preguntas frecuentes.
 *
 * LAS CIFRAS DE ENVÍO NO ESTÁN ESCRITAS A MANO: salen de las mismas constantes
 * que usa el checkout para cobrar. Si mañana cambia la tarifa, esta página
 * cambia sola. Un FAQ que promete un precio distinto del que cobra la caja es
 * peor que no tener FAQ — y es exactamente el error que se comete al teclear
 * "$99" aquí dentro.
 *
 * FALTAN DOS PREGUNTAS A PROPÓSITO: alérgenos y si son veganas. Están sin
 * publicar hasta tener el detalle por producto, no por pereza: una tabla de
 * alérgenos equivocada manda a alguien a urgencias, y el catálogo incluye
 * chapulín y gusano, que no son aptos para quien no come animales.
 */

interface Pregunta {
  q: string;
  a: ReactElement;
}

const ENVIOS: Pregunta[] = [
  {
    q: "¿A qué parte de México envían?",
    a: <p>A todo el país.</p>,
  },
  {
    q: "¿Cuánto tarda en llegar?",
    a: (
      <p>
        De 1 a 3 días en zona metropolitana, y de 3 a 5 días en el resto del país,
        contando desde que sale el pedido.
      </p>
    ),
  },
  {
    q: "¿Cuánto cuesta el envío?",
    a: (
      <p>
        {formatMoney(FLAT_SHIPPING_CENTS)} a todo México. A partir de{" "}
        {formatMoney(FREE_SHIPPING_THRESHOLD_CENTS)} de compra el envío va incluido.
      </p>
    ),
  },
  {
    q: "¿Con qué paquetería envían?",
    a: <p>Con DHL.</p>,
  },
  {
    q: "¿Puedo recogerlo en persona?",
    a: (
      <p>
        Sí, en Zapopan, Jalisco. Se acuerda antes por{" "}
        <Link href="/contacto" className="text-brand-700 hover:underline">
          WhatsApp
        </Link>
        .
      </p>
    ),
  },
  {
    q: "¿Me mandan número de rastreo?",
    a: <p>Sí. Te lo enviamos por WhatsApp en cuanto el pedido sale.</p>,
  },
];

const PRODUCTO: Pregunta[] = [
  {
    q: "¿Cuánto dura el producto cerrado?",
    a: <p>Hasta 3 años sin abrir.</p>,
  },
  {
    q: "¿Y una vez abierto? ¿Hay que refrigerarlo?",
    a: (
      <p>
        Sí. Una vez abierto, en refrigeración dura hasta 6 meses. Al no llevar
        conservadores, el frío es lo que hace ese trabajo.
      </p>
    ),
  },
  {
    q: "¿Llevan conservadores?",
    a: <p>No. Ninguno de nuestros productos lleva conservadores.</p>,
  },
  {
    q: "¿Qué tan pican?",
    a: (
      <p>
        Manejamos una escala del 1 al 5, del más suave al más bravo. El nivel viene
        indicado en cada producto.
      </p>
    ),
  },
];

const PAGOS: Pregunta[] = [
  {
    q: "¿Cómo puedo pagar?",
    a: (
      <p>
        Con tarjeta de crédito o débito. Por ahora es el único método: todavía no
        aceptamos pago en OXXO ni transferencia.
      </p>
    ),
  },
  {
    q: "¿Es seguro pagar aquí?",
    a: (
      <p>
        Sí. Los datos de tu tarjeta se teclean directamente en la plataforma de pagos de
        Stripe, no en nuestro sitio: nosotros nunca vemos ni guardamos el número.
      </p>
    ),
  },
];

const PEDIDOS: Pregunta[] = [
  {
    q: "¿Puedo cambiar o cancelar mi pedido?",
    a: <p>Sí, hasta 48 horas antes de que salga el envío.</p>,
  },
  {
    q: "¿Aceptan devoluciones?",
    a: (
      <p>
        Al tratarse de alimentos, no aceptamos devoluciones por gusto, y tampoco de
        producto ya abierto. Sí reponemos si el pedido llega dañado, incompleto o
        equivocado.
      </p>
    ),
  },
  {
    q: "Mi pedido llegó dañado o incompleto. ¿Qué hago?",
    a: (
      <p>
        Avísanos dentro de los 7 días siguientes a recibirlo, por{" "}
        <Link href="/contacto" className="text-brand-700 hover:underline">
          WhatsApp o correo
        </Link>
        , con una foto de cómo llegó. Lo resolvemos.
      </p>
    ),
  },
  {
    q: "¿Venden al mayoreo?",
    a: <p>Sí, a partir de 30 piezas. Escríbenos y lo vemos.</p>,
  },
];

const SECCIONES: { titulo: string; preguntas: Pregunta[] }[] = [
  { titulo: "Envíos", preguntas: ENVIOS },
  { titulo: "El producto", preguntas: PRODUCTO },
  { titulo: "Pagos", preguntas: PAGOS },
  { titulo: "Pedidos y devoluciones", preguntas: PEDIDOS },
];

export default function PreguntasPage(): ReactElement {
  return (
    <>
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <Revelar>
          <p className="text-sm tracking-widest text-brand-700 uppercase">Ayuda</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink-900 sm:text-5xl">
            Preguntas frecuentes
          </h1>
        </Revelar>

        {SECCIONES.map((seccion, indice) => (
          <Revelar key={seccion.titulo} retraso={indice * 60}>
            <section className="mt-14">
              <h2 className="font-display text-2xl text-ink-900">{seccion.titulo}</h2>

              {/* <details> nativo y no un acordeón de JavaScript: se abre sin
                  esperar a que cargue nada, funciona con teclado sin escribir
                  una línea, y el buscador lee el contenido aunque esté cerrado. */}
              <div className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
                {seccion.preguntas.map((pregunta) => (
                  <details key={pregunta.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-ink-900 marker:content-none">
                      <span className="font-medium">{pregunta.q}</span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-brand-700 transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <div className="mt-3 text-ink-700">{pregunta.a}</div>
                  </details>
                ))}
              </div>
            </section>
          </Revelar>
        ))}

        <Revelar>
          <p className="mt-14 text-ink-500">
            ¿No está tu pregunta aquí?{" "}
            <Link href="/contacto" className="text-brand-700 hover:underline">
              Escríbenos
            </Link>
            .
          </p>
        </Revelar>
      </main>

      <Footer />
    </>
  );
}
