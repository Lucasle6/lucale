/**
 * Endpoint del webhook de Stripe.
 *
 * ESTA RUTA NO PARSEA EL JSON, Y ESO ES A PROPÓSITO.
 *
 * Stripe firma el cuerpo byte a byte. Fastify, por defecto, convierte el JSON
 * entrante en un objeto de JavaScript — y los bytes originales dejan de
 * existir. Volver a serializar ese objeto no reproduce la entrada exacta: basta
 * un espacio distinto o un orden de claves diferente para que el HMAC no
 * cuadre.
 *
 * El síntoma, si se pasa por alto, es de los que cuestan una tarde entera:
 * firma inválida SIEMPRE, con el secreto correcto y el código aparentemente
 * bien.
 *
 * La solución es el `addContentTypeParser` de abajo, que deja el cuerpo como
 * Buffer. Y va DENTRO de un `register`, no en la aplicación entera: los plugins
 * de Fastify encapsulan, así que el parser solo afecta a las rutas declaradas
 * en este ámbito. El resto de la API sigue recibiendo su JSON parseado.
 */

import type { FastifyInstance } from "fastify";
import * as controller from "./stripe-webhook.controller.js";

/** Tope del cuerpo. Un evento de Stripe no llega ni de lejos a esto. */
const LIMITE_CUERPO_BYTES = 1_048_576; // 1 MiB

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  await app.register((instancia, _opciones, listo) => {
    instancia.addContentTypeParser(
      "application/json",
      { parseAs: "buffer", bodyLimit: LIMITE_CUERPO_BYTES },
      (_peticion, cuerpo, hecho) => {
        // Se entrega tal cual llegó. Ni JSON.parse, ni nada.
        hecho(null, cuerpo);
      },
    );

    instancia.post("/webhooks/stripe", {
      schema: {
        tags: ["webhooks"],
        summary: "Recibe los eventos de pago de Stripe",
        description:
          "Endpoint público, autenticado por FIRMA en la cabecera stripe-signature. " +
          "Es la única vía por la que un pedido pasa a PAID: el redirect del " +
          "navegador no confirma nada.",
        // Sin `body` en el esquema: si se declarara, Zod intentaría validar un
        // Buffer contra una forma de objeto y lo rechazaría antes de llegar al
        // controlador.
      },
      config: {
        // Stripe reintenta con reintentos exponenciales durante días y puede
        // ráfagar tras una caída. Limitarlo como a un humano provocaría que
        // descartáramos pagos legítimos.
        rateLimit: false,
      },
      handler: controller.recibirEventoStripe,
    });

    listo();
  });
}
