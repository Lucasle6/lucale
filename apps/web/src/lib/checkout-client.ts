"use client";

/**
 * Llamada al checkout desde el navegador.
 *
 * Va directa del navegador a la API, sin pasar por el servidor de Next, porque
 * la identidad del carrito vive en una cookie del navegador. `credentials:
 * "include"` es lo que la hace viajar; sin eso, la API vería a un desconocido
 * con el carrito vacío justo en el momento de pagar.
 */

import type { CheckoutInput, CheckoutSession } from "@bodegon/shared";
import { conCsrf } from "./csrf";

/**
 * El navegador llama a la API a través de SU PROPIO origen.
 *
 * `/v1` es una ruta relativa, no un dominio: Next la reenvía a la API por
 * detrás (ver la reescritura en next.config.ts). Así las cookies son de
 * primera parte y el CORS no interviene.
 *
 * Antes esto apuntaba al dominio de la API. En desarrollo funcionaba porque
 * localhost:3000 y localhost:4000 son el mismo host; en producción, con la
 * tienda y la API en dominios distintos, el navegador descartaba las cookies
 * y el carrito dejaba de guardar nada.
 */
const API_URL = "/v1";

export async function crearSesionDePago(input: CheckoutInput): Promise<CheckoutSession> {
  const response = await fetch(`${API_URL}/checkout/session`, {
    method: "POST",
    credentials: "include",
    headers: await conCsrf({ "content-type": "application/json" }),
    body: JSON.stringify(input),
  });

  const cuerpo: unknown = await response.json();

  if (!response.ok) {
    // Los mensajes del service están escritos para leerse tal cual ("De esta
    // pieza solo quedan 3"), así que se muestran sin traducir. Solo se pone
    // uno genérico si la respuesta no trae ninguno.
    const mensaje =
      typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo
        ? ((cuerpo.error as { message?: string }).message ?? "No pudimos iniciar el pago")
        : "No pudimos iniciar el pago";
    throw new Error(mensaje);
  }

  return cuerpo as CheckoutSession;
}
