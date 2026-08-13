/**
 * Traduce HTTP ↔ negocio para el checkout.
 *
 * Es deliberadamente diminuto. Todo lo que decide algo —qué precio, qué total,
 * qué se congela— vive en el service. Aquí solo se resuelve de quién es el
 * carrito y se devuelve la respuesta.
 */

import type { CheckoutInput } from "@bodegon/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { resolverDueno } from "../cart/cart.controller.js";
import * as checkoutService from "./checkout.service.js";

export async function createSession(
  request: FastifyRequest<{ Body: CheckoutInput }>,
  reply: FastifyReply,
): Promise<void> {
  // La misma resolución de identidad que usa el carrito. No una parecida: la
  // misma función.
  const owner = await resolverDueno(request, reply);

  // Del cuerpo solo salen el correo y la dirección. Ningún importe, porque el
  // esquema no tiene dónde ponerlo.
  const sesion = await checkoutService.createCheckoutSession(owner, request.body);

  await reply.send(sesion);
}
