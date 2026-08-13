/**
 * Traduce HTTP ↔ negocio para el webhook de Stripe.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../lib/errors.js";
import * as service from "./stripe-webhook.service.js";

export async function recibirEventoStripe(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const firma = request.headers["stripe-signature"];

  if (typeof firma !== "string") {
    // Sin cabecera de firma no hay nada que verificar. 400 y no 401 porque
    // para Stripe significa "petición mal formada, no la reintentes".
    throw new AppError(400, "MISSING_SIGNATURE", "Falta la cabecera stripe-signature");
  }

  // El cuerpo llega como Buffer gracias al parser declarado en las rutas.
  // Si esto fuera un objeto, la firma no cuadraría jamás.
  if (!Buffer.isBuffer(request.body)) {
    throw new AppError(
      500,
      "RAW_BODY_MISSING",
      "El cuerpo del webhook no llegó crudo; revisa el content type parser",
    );
  }

  const resultado = await service.handleStripeEvent(request.body, firma, request.log);

  // A Stripe se le responde rápido. Si tardamos más de unos segundos, da la
  // entrega por fallida y reintenta, aunque el trabajo se haya hecho.
  await reply.send(resultado);
}
