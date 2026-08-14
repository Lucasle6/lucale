"use client";

/**
 * Llamadas al carrito desde el navegador.
 *
 * `credentials: "include"` hace que viaje la cookie del carrito. Sin eso, cada
 * petición crearía un carrito nuevo y el usuario nunca vería lo que añadió.
 */

import type { Cart } from "@bodegon/shared";
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

async function pedir(path: string, options: RequestInit = {}): Promise<Cart> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    // El token CSRF viaja en cabecera además de en cookie. Es lo que un sitio
    // ajeno no puede falsificar: puede provocar que el navegador mande la
    // cookie, pero no leerla para copiarla aquí.
    headers: await conCsrf({
      "content-type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    }),
  });

  const cuerpo: unknown = await response.json();

  if (!response.ok) {
    const mensaje =
      typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo
        ? ((cuerpo.error as { message?: string }).message ?? "No se pudo actualizar")
        : "No se pudo actualizar el carrito";
    throw new Error(mensaje);
  }

  return cuerpo as Cart;
}

export function addToCart(variantId: string, quantity = 1): Promise<Cart> {
  // Solo se envían variantId y quantity. No hay precio que enviar.
  return pedir("/cart/items", {
    method: "POST",
    body: JSON.stringify({ variantId, quantity }),
  });
}

export function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  return pedir(`/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}
