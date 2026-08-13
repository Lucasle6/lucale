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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

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
