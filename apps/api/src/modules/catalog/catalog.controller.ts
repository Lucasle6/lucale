/**
 * Traduce HTTP ↔ negocio. Nada más.
 *
 * Corto a propósito: extrae datos del request, llama al service, envía la
 * respuesta. Sin try/catch (de eso se encarga el manejador central) y sin
 * lógica — si empezara a tener `if`, esos `if` pertenecen al service.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import * as catalogService from "./catalog.service.js";
import type { ProductListQuery, ProductParams } from "./catalog.schemas.js";

export async function listProducts(
  request: FastifyRequest<{ Querystring: ProductListQuery }>,
  reply: FastifyReply,
): Promise<void> {
  // request.query ya viene validado y tipado por el esquema Zod de la ruta.
  const result = await catalogService.listProducts(request.query);
  await reply.send(result);
}

export async function getProduct(
  request: FastifyRequest<{ Params: ProductParams }>,
  reply: FastifyReply,
): Promise<void> {
  const product = await catalogService.getProductBySlug(request.params.slug);
  await reply.send(product);
}

export async function listCategories(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await catalogService.listCategories();
  await reply.send(result);
}
