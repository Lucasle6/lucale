/**
 * Traduce HTTP ↔ negocio para el carrito.
 *
 * Aquí se resuelve "de quién es este carrito": de un usuario con sesión, o de
 * un invitado identificado por una cookie firmada.
 */

import type { AddToCartInput, UpdateCartItemInput } from "@bodegon/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { generateToken } from "../../lib/tokens.js";
import { TOKEN_AUDIENCE, verifyAccessToken } from "../../lib/jwt.js";
import { COOKIE_NAMES } from "../../lib/jwt.js";
import { isProduction } from "../../config/env.js";
import * as cartService from "./cart.service.js";
import type { CartOwner } from "./cart.service.js";

/** Nombre de la cookie que identifica el carrito de un invitado. */
export const CART_COOKIE = isProduction ? "__Host-cart_session" : "cart_session";

const CART_COOKIE_DAYS = 30;

function opcionesDeCookie(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  signed: true;
} {
  return {
    // httpOnly aunque no lleve nada secreto: no hay razón para que JavaScript
    // pueda leer el identificador del carrito.
    httpOnly: true,
    secure: isProduction,
    // "lax" y no "strict" a diferencia de la sesión: si alguien llega desde un
    // enlace compartido, queremos que su carrito siga ahí. No protege nada
    // crítico —el carrito no autoriza pagos— y strict rompería ese caso.
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_DAYS * 24 * 60 * 60,
    signed: true,
  };
}

/**
 * Determina de quién es el carrito.
 *
 * Si hay sesión de cliente, es suyo. Si no, se usa (o se crea) el token de
 * invitado de la cookie.
 *
 * Se exporta porque el checkout tiene que resolver la identidad EXACTAMENTE
 * igual: si usara otra lógica, alguien podría acabar pagando un carrito que no
 * es el suyo, o encontrarse con que el suyo "no existe" al llegar a pagar.
 */
export async function resolverDueno(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<CartOwner> {
  // ¿Hay sesión de cliente? Se comprueba sin exigirla: el carrito funciona
  // igual sin cuenta.
  const accessCookie = request.cookies[COOKIE_NAMES.accessToken];
  if (accessCookie !== undefined) {
    const unsigned = request.unsignCookie(accessCookie);
    if (unsigned.valid && unsigned.value !== null) {
      try {
        const payload = await verifyAccessToken(unsigned.value, TOKEN_AUDIENCE.customer);
        return { tipo: "usuario", userId: payload.sub };
      } catch {
        // Token caducado o inválido: se sigue como invitado en vez de fallar.
      }
    }
  }

  const cartCookie = request.cookies[CART_COOKIE];
  if (cartCookie !== undefined) {
    const unsigned = request.unsignCookie(cartCookie);
    if (unsigned.valid && unsigned.value !== null) {
      return { tipo: "invitado", sessionToken: unsigned.value };
    }
  }

  // Primer contacto: se emite un token de invitado.
  const sessionToken = generateToken();
  reply.setCookie(CART_COOKIE, sessionToken, opcionesDeCookie());
  return { tipo: "invitado", sessionToken };
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export async function getCart(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const owner = await resolverDueno(request, reply);
  await reply.send(await cartService.getCart(owner));
}

export async function addItem(
  request: FastifyRequest<{ Body: AddToCartInput }>,
  reply: FastifyReply,
): Promise<void> {
  const owner = await resolverDueno(request, reply);
  // Nótese que del cuerpo solo se leen variantId y quantity: no hay ningún
  // precio que leer, porque el esquema no lo admite.
  const carrito = await cartService.addItem(
    owner,
    request.body.variantId,
    request.body.quantity,
  );
  await reply.send(carrito);
}

export async function updateItem(
  request: FastifyRequest<{ Params: { itemId: string }; Body: UpdateCartItemInput }>,
  reply: FastifyReply,
): Promise<void> {
  const owner = await resolverDueno(request, reply);
  const carrito = await cartService.updateItem(
    owner,
    request.params.itemId,
    request.body.quantity,
  );
  await reply.send(carrito);
}

export async function removeItem(
  request: FastifyRequest<{ Params: { itemId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const owner = await resolverDueno(request, reply);
  await reply.send(await cartService.removeItem(owner, request.params.itemId));
}

export async function clearCart(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const owner = await resolverDueno(request, reply);
  await reply.send(await cartService.clear(owner));
}
