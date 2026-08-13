"use client";

/**
 * Llamadas al carrito desde el navegador.
 *
 * `credentials: "include"` hace que viaje la cookie del carrito. Sin eso, cada
 * petición crearía un carrito nuevo y el usuario nunca vería lo que añadió.
 */

import type { Cart } from "@bodegon/shared";
import { conCsrf } from "./csrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

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
