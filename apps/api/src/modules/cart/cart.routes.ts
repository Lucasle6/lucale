/**
 * Endpoints del carrito.
 *
 * No exigen sesión: se puede comprar como invitado. La identidad se resuelve
 * en el controller — cuenta si la hay, cookie firmada si no.
 */

import {
  addToCartSchema,
  cartItemParamsSchema,
  cartSchema,
  updateCartItemSchema,
} from "@bodegon/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as controller from "./cart.controller.js";

export function cartRoutes(app: FastifyInstance): void {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get("/cart", {
    schema: {
      tags: ["cart"],
      summary: "Carrito actual, con los precios leídos de la base",
      response: { 200: cartSchema },
    },
    handler: controller.getCart,
  });

  route.post("/cart/items", {
    schema: {
      tags: ["cart"],
      summary: "Añade una variante al carrito",
      // El cuerpo solo admite variantId y quantity. No hay campo de precio, ni
      // siquiera opcional: el esquema lo hace imposible.
      body: addToCartSchema,
      response: { 200: cartSchema },
    },
    handler: controller.addItem,
  });

  route.patch("/cart/items/:itemId", {
    schema: {
      tags: ["cart"],
      summary: "Cambia la cantidad de una línea (0 la elimina)",
      params: cartItemParamsSchema,
      body: updateCartItemSchema,
      response: { 200: cartSchema },
    },
    handler: controller.updateItem,
  });

  route.delete("/cart/items/:itemId", {
    schema: {
      tags: ["cart"],
      summary: "Quita una línea del carrito",
      params: cartItemParamsSchema,
      response: { 200: cartSchema },
    },
    handler: controller.removeItem,
  });

  route.delete("/cart", {
    schema: {
      tags: ["cart"],
      summary: "Vacía el carrito",
      response: { 200: cartSchema },
    },
    handler: controller.clearCart,
  });
}
