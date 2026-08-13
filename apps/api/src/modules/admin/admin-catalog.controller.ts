/**
 * Traduce HTTP ↔ negocio para el catálogo del panel.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { auditContext } from "../../lib/audit.js";
import { ValidationError } from "../../lib/errors.js";
import { MAX_IMAGE_BYTES, validateAndProcessImage } from "../../lib/image-validation.js";
import type { Storage } from "../../lib/storage.js";
import { currentUser } from "../../plugins/authenticate.js";
import * as repo from "./admin-catalog.repository.js";
import * as service from "./admin-catalog.service.js";
import type { ActionContext } from "./admin-catalog.service.js";
import type {
  AdminProductListQuery,
  CreateCategoryInput,
  CreateProductInput,
  UpdateProductInput,
} from "@bodegon/shared";

function contexto(request: FastifyRequest): ActionContext {
  return {
    actor: currentUser(request),
    ...auditContext(request),
    log: request.log,
  };
}

// ─── Productos ───────────────────────────────────────────────────────────────

export async function listProducts(
  request: FastifyRequest<{ Querystring: AdminProductListQuery }>,
  reply: FastifyReply,
): Promise<void> {
  await reply.send(await service.listProducts(request.query));
}

export async function getProduct(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await reply.send(await service.getProduct(request.params.id));
}

export async function createProduct(
  request: FastifyRequest<{ Body: CreateProductInput }>,
  reply: FastifyReply,
): Promise<void> {
  const producto = await service.createProduct(request.body, contexto(request));
  await reply.status(201).send(producto);
}

export async function updateProduct(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateProductInput }>,
  reply: FastifyReply,
): Promise<void> {
  const producto = await service.updateProduct(
    request.params.id,
    request.body,
    contexto(request),
  );
  await reply.send(producto);
}

export async function archiveProduct(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await service.archiveProduct(request.params.id, contexto(request));
  await reply.send({ message: "Producto archivado" });
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export async function createCategory(
  request: FastifyRequest<{ Body: CreateCategoryInput }>,
  reply: FastifyReply,
): Promise<void> {
  const categoria = await service.createCategory(request.body);
  await reply.status(201).send(categoria);
}

// ─── Imágenes ────────────────────────────────────────────────────────────────

export function uploadImage(storage: Storage) {
  return async function handler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const productId = request.params.id;
    // Comprobar que el producto existe ANTES de procesar la imagen: no tiene
    // sentido gastar CPU reprocesando un archivo que no se va a poder asociar.
    await service.getProduct(productId);

    const existentes = await repo.countProductImages(productId);
    if (existentes >= service.MAX_IMAGES_PER_PRODUCT) {
      throw new ValidationError(
        `Un producto admite como máximo ${String(service.MAX_IMAGES_PER_PRODUCT)} imágenes`,
      );
    }

    const archivo = await request.file({ limits: { fileSize: MAX_IMAGE_BYTES } });
    if (archivo === undefined) {
      throw new ValidationError("No se recibió ningún archivo");
    }

    const bruto = await archivo.toBuffer();

    // Aquí se cae un archivo que solo FINGE ser imagen: ni la extensión ni el
    // Content-Type que envió el cliente cuentan para nada.
    const procesada = await validateAndProcessImage(bruto);

    const url = await storage.save(procesada.buffer, procesada.format);

    const alt = leerAlt(archivo.fields);
    const imagen = await repo.createProductImage({
      productId,
      url,
      alt,
      position: existentes,
      width: procesada.width,
      height: procesada.height,
    });

    await reply.status(201).send({
      id: imagen.id,
      url: imagen.url,
      width: procesada.width,
      height: procesada.height,
      bytes: procesada.bytes,
    });
  };
}

export function deleteImage(storage: Storage) {
  return async function handler(
    request: FastifyRequest<{ Params: { id: string; imageId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const imagen = await repo.findProductImage(request.params.imageId);

    // Se comprueba que la imagen pertenece a ESTE producto: sin esto, alguien
    // podría borrar la imagen de otro producto pasando su id (IDOR).
    if (imagen === null || imagen.productId !== request.params.id) {
      throw new ValidationError("La imagen no existe en este producto");
    }

    await repo.deleteProductImage(imagen.id);
    await storage.remove(imagen.url);

    await reply.send({ message: "Imagen eliminada" });
  };
}

/** El texto alternativo llega como campo del formulario multipart. */
function leerAlt(fields: unknown): string | undefined {
  if (typeof fields !== "object" || fields === null) return undefined;
  const alt = (fields as Record<string, unknown>).alt;
  if (
    typeof alt === "object" &&
    alt !== null &&
    "value" in alt &&
    typeof alt.value === "string"
  ) {
    return alt.value.slice(0, 200);
  }
  return undefined;
}
