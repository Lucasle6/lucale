/**
 * Endpoints del checkout.
 *
 * No exigen sesión: se puede comprar como invitado. Obligar a registrarse justo
 * antes de pagar es el mayor destructor de conversión de una tienda, y el
 * modelo de datos ya lo tenía previsto — `Order.userId` es opcional y
 * `Order.email` no lo es. Esa asimetría del Día 2 existía para este momento.
 */

import { checkoutSchema, checkoutSessionSchema } from "@bodegon/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "../../config/env.js";
import * as controller from "./checkout.controller.js";

const EN_TESTS = env.VITEST !== undefined;

/**
 * Límite del checkout.
 *
 * El razonamiento no es el del login. Ahí el peligro es adivinar una
 * contraseña, y por eso son 5 intentos cada 15 minutos. Aquí no hay nada que
 * adivinar: el peligro es el GASTO. Cada petición escribe un pedido en la base
 * y consume una llamada a Stripe, así que un bucle llenaría el panel de pedidos
 * fantasma y quemaría la cuota de la API.
 *
 * Diez cada cuarto de hora deja sitio de sobra a quien reintenta porque le
 * rechazaron la tarjeta, y corta el bucle automático.
 */
const LIMITE_CHECKOUT = EN_TESTS ? false : { max: 10, timeWindow: "15 minutes" };

export function checkoutRoutes(app: FastifyInstance): void {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.post("/checkout/session", {
    schema: {
      tags: ["checkout"],
      summary: "Congela el pedido y devuelve la URL de pago de Stripe",
      description:
        "Relee los precios de la base, crea el pedido en PENDING y pide a Stripe " +
        "una sesión de pago con esos importes. El pedido no se marca como pagado " +
        "aquí: eso solo ocurre al recibir el webhook firmado de Stripe.",
      body: checkoutSchema,
      // 200 y no 201: aunque por dentro se crea un pedido, lo que devolvemos no
      // es ese recurso sino una instrucción de a dónde ir a pagar.
      response: { 200: checkoutSessionSchema },
    },
    config: { rateLimit: LIMITE_CHECKOUT },
    handler: controller.createSession,
  });
}
