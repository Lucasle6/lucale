// Compone el mensaje con lo que se teclea, así que necesita estado.
"use client";

import { Button, Input, Textarea } from "@bodegon/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { WHATSAPP_MX } from "../lib/contacto";

/**
 * Formulario de contacto.
 *
 * NO MANDA UN CORREO: abre WhatsApp con el mensaje ya escrito.
 *
 * Podría enviarse a un endpoint nuestro, pero hoy el sistema de correo del
 * proyecto escribe en el log y no manda nada. Un formulario así se traga el
 * mensaje y deja al cliente convencido de que llegó — es la peor de las tres
 * opciones, peor incluso que no tener formulario.
 *
 * Esto, en cambio, funciona hoy y no miente: el mensaje sale del teléfono de
 * quien escribe, así que él ve que se envió y conserva la conversación. Además
 * es como se habla de verdad con una marca pequeña en México.
 *
 * CUANDO SE CONECTE UN PROVEEDOR DE CORREO, se sustituye el `onSubmit` por una
 * llamada al endpoint y el resto del componente no cambia.
 */
export function FormularioContacto(): ReactElement {
  const [nombre, setNombre] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");

  const listo = nombre.trim().length > 1 && mensaje.trim().length > 4;

  function abrirWhatsApp(): void {
    const texto = [
      `Hola, soy ${nombre.trim()}.`,
      asunto.trim() === "" ? null : `Asunto: ${asunto.trim()}`,
      "",
      mensaje.trim(),
    ]
      .filter((linea) => linea !== null)
      .join("\n");

    // `encodeURIComponent` y no concatenar a pelo: sin él, un mensaje con un
    // `&` o un `#` se corta a la mitad al llegar a WhatsApp.
    window.open(
      `${WHATSAPP_MX.enlace}?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <section className="border-t border-border-subtle py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="font-display text-3xl text-ink-900">¿Hablamos?</h2>
          <p className="mt-4 max-w-prose text-ink-700">
            Para pedidos especiales, mayoreo o dudas sobre un producto. Escribe aquí y se
            abre WhatsApp con tu mensaje listo para enviar.
          </p>
          <p className="mt-4 text-sm text-ink-500">
            Contestamos nosotros dos, así que a veces tardamos unas horas.
          </p>
        </div>

        <form
          // Formulario de verdad y no un montón de divs: se envía con Enter, el
          // navegador agrupa los campos, y un lector de pantalla lo anuncia como
          // formulario.
          onSubmit={(evento) => {
            evento.preventDefault();
            abrirWhatsApp();
          }}
          className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-6"
        >
          <Input
            label="Tu nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
            }}
            required
            autoComplete="name"
          />
          <Input
            label="Asunto"
            value={asunto}
            onChange={(e) => {
              setAsunto(e.target.value);
            }}
            placeholder="Mayoreo, pedido especial, una duda…"
          />
          <Textarea
            label="Mensaje"
            value={mensaje}
            onChange={(e) => {
              setMensaje(e.target.value);
            }}
            required
            rows={5}
          />

          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={!listo}>
              Abrir WhatsApp
            </Button>
            {/* Se dice ANTES de pulsar lo que va a pasar. Un botón que abre otra
                aplicación sin avisar se siente como que algo falló. */}
            <p className="text-sm text-ink-500">
              Se abre WhatsApp con el mensaje escrito. Tú le das enviar.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
