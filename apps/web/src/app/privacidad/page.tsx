import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Footer } from "../../components/footer";
import { Header } from "../../components/header";
import { CORREO_PRIVACIDAD, UBICACION } from "../../lib/contacto";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description:
    "Qué datos personales recabamos en LuCaLe, para qué los usamos, con quién los compartimos y cómo ejercer tus derechos ARCO.",
  // No tiene sentido que este documento compita en buscadores con el catálogo.
  robots: { index: false, follow: true },
};

/** Responsable del tratamiento, según lo declarado por el titular del negocio. */
const RESPONSABLE = "José Luis Castañeda León";

/**
 * Aviso de privacidad (LFPDPPP).
 *
 * ESTO NO ES ASESORÍA LEGAL. Está redactado a partir de lo que el sistema
 * REALMENTE hace, no de una plantilla genérica: los campos listados son
 * exactamente los que pide el checkout y los que guarda la tabla de usuarios, y
 * los terceros son los que de verdad reciben datos. Un aviso copiado de
 * internet suele declarar tratamientos que no ocurren y omitir los que sí.
 *
 * Para defender el proyecto sobra. El día que el negocio facture en serio,
 * conviene que lo revise alguien con cédula.
 *
 * Si cambia lo que se recaba —por ejemplo al conectar un proveedor de correo—
 * hay que actualizar este documento, no solo el código.
 */
export default function PrivacidadPage(): ReactElement {
  return (
    <>
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm tracking-widest text-brand-700 uppercase">Legal</p>
        <h1 className="mt-4 font-display text-4xl leading-tight text-ink-900">
          Aviso de privacidad
        </h1>
        <p className="mt-4 text-ink-500">Última actualización: agosto de 2026</p>

        <div className="mt-12 flex flex-col gap-10 text-ink-700">
          <section>
            <h2 className="font-display text-4xl text-ink-900">Quién es responsable</h2>
            <p className="mt-3">
              <strong className="text-ink-900">{RESPONSABLE}</strong>, persona física con
              actividad empresarial, con domicilio de operación en {UBICACION.ciudad},{" "}
              {UBICACION.estado}, es el responsable del tratamiento de tus datos
              personales, conforme a la Ley Federal de Protección de Datos Personales en
              Posesión de los Particulares.
            </p>
          </section>

          <section>
            <h2 className="font-display text-4xl text-ink-900">Qué datos recabamos</h2>
            <p className="mt-3">Para procesar y entregar un pedido te pedimos:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Nombre de quien recibe</li>
              <li>Correo electrónico</li>
              <li>Teléfono de contacto</li>
              <li>
                Dirección de envío: calle, número exterior e interior, colonia, ciudad,
                estado, código postal y referencias
              </li>
            </ul>
            <p className="mt-4">
              Si además creas una cuenta, guardamos tu correo y una versión cifrada e
              irreversible de tu contraseña.{" "}
              <strong>Nunca guardamos tu contraseña en texto legible</strong>, ni siquiera
              nosotros podemos leerla.
            </p>
            <p className="mt-4">
              <strong className="text-ink-900">No recabamos datos de tu tarjeta.</strong>{" "}
              El pago ocurre íntegramente en la plataforma de Stripe: los números de
              tarjeta nunca pasan por nuestros servidores ni quedan guardados aquí.
            </p>
          </section>

          <section>
            <h2 className="font-display text-4xl text-ink-900">Para qué los usamos</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Preparar, cobrar y enviar tu pedido</li>
              <li>Contactarte sobre ese pedido si hace falta</li>
              <li>Atender aclaraciones, cambios o reposiciones</li>
              <li>Cumplir obligaciones fiscales y contables cuando apliquen</li>
            </ul>
            <p className="mt-4">
              No usamos tus datos para publicidad ni los vendemos a nadie.
            </p>
          </section>

          <section>
            <h2 className="font-display text-4xl text-ink-900">Con quién se comparten</h2>
            <p className="mt-3">
              Solo con quien hace falta para que el pedido llegue y se cobre:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>
                <strong className="text-ink-900">Stripe</strong>, para procesar el pago
              </li>
              <li>
                <strong className="text-ink-900">DHL</strong>, para entregar el paquete
              </li>
              <li>
                Los proveedores que alojan la tienda y la base de datos, que la almacenan
                por cuenta nuestra
              </li>
            </ul>
            <p className="mt-4">
              Ninguno de ellos puede usar tus datos para fines propios distintos del
              servicio que nos presta.
            </p>
          </section>

          <section>
            <h2 className="font-display text-4xl text-ink-900">Tus derechos</h2>
            <p className="mt-3">
              Tienes derecho a <strong className="text-ink-900">acceder</strong> a tus
              datos, <strong className="text-ink-900">rectificarlos</strong> si son
              incorrectos, <strong className="text-ink-900">cancelarlos</strong> y{" "}
              <strong className="text-ink-900">oponerte</strong> a su uso — los llamados
              derechos ARCO. También puedes revocar tu consentimiento.
            </p>
            <p className="mt-4">
              Escríbenos a{" "}
              <a
                href={`mailto:${CORREO_PRIVACIDAD}`}
                className="text-brand-700 underline-offset-4 hover:underline"
              >
                {CORREO_PRIVACIDAD}
              </a>{" "}
              indicando qué quieres y desde qué correo hiciste tu pedido. Te contestamos.
            </p>
            <p className="mt-4 text-ink-500">
              Hay datos que no podemos borrar de inmediato: los de un pedido ya cobrado
              deben conservarse el tiempo que exijan las obligaciones fiscales.
            </p>
          </section>

          <section>
            <h2 className="font-display text-4xl text-ink-900">Cambios a este aviso</h2>
            <p className="mt-3">
              Si cambiamos lo que recabamos o para qué lo usamos, actualizaremos esta
              página y la fecha de arriba.
            </p>
          </section>
        </div>

        <p className="mt-14 border-t border-border-subtle pt-8 text-sm text-ink-500">
          ¿Dudas?{" "}
          <Link href="/contacto" className="text-brand-700 hover:underline">
            Escríbenos
          </Link>
          .
        </p>
      </main>

      <Footer />
    </>
  );
}
