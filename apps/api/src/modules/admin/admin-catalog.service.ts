/**
 * Reglas de negocio del catálogo desde el panel.
 *
 * Cada mutación deja rastro en el registro de auditoría: un producto que
 * aparece con precio $1 debe poder rastrearse hasta quién lo puso así.
 */

import type { User } from "@bodegon/db";
import { prisma } from "@bodegon/db";
import { formatMoney, slugWithSuffix, slugify } from "@bodegon/shared";
import type { FastifyBaseLogger } from "fastify";
import { AUDIT_ACTIONS, recordAudit } from "../../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import * as repo from "./admin-catalog.repository.js";
import type { AdminProduct } from "./admin-catalog.repository.js";
import type {
  AdminProductListQuery,
  CreateCategoryInput,
  CreateProductInput,
  UpdateProductInput,
} from "@bodegon/shared";

export interface ActionContext {
  actor: User;
  ip?: string | undefined;
  userAgent?: string | undefined;
  log: FastifyBaseLogger;
}

/** Máximo de imágenes por producto. Evita galerías inmanejables. */
export const MAX_IMAGES_PER_PRODUCT = 8;

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function listProducts(query: AdminProductListQuery) {
  const productos = await repo.findProducts(query);

  const hayMas = productos.length > query.limit;
  const items = hayMas ? productos.slice(0, query.limit) : productos;
  const ultimo = items.at(-1);

  return {
    items: items.map(toAdminProduct),
    nextCursor: hayMas && ultimo !== undefined ? ultimo.id : null,
  };
}

export async function getProduct(id: string) {
  const producto = await repo.findProductById(id);
  if (producto === null) {
    throw new NotFoundError("El producto no existe");
  }
  return toAdminProduct(producto);
}

// ─── Creación ────────────────────────────────────────────────────────────────

export async function createProduct(input: CreateProductInput, context: ActionContext) {
  await verificarSkusLibres(input.variants.map((v) => v.sku));

  if (input.categoryId !== undefined) {
    await verificarCategoria(input.categoryId);
  }

  const slug = await slugDisponible(input.slug ?? slugify(input.name));

  const creado = await repo.createProduct({
    name: input.name,
    slug,
    description: input.description ?? null,
    status: input.status,
    // Se pasa explícitamente aunque la columna tenga valor por defecto: si se
    // omitiera, Prisma escribiría 1600 en silencio y cada alimento se vendería
    // con 16% sin que nada avisara.
    taxRateBps: input.taxRateBps,
    ...(input.categoryId === undefined
      ? {}
      : { category: { connect: { id: input.categoryId } } }),
    // Quién dio de alta el producto: parte de la trazabilidad.
    createdBy: { connect: { id: context.actor.id } },
    variants: {
      create: input.variants.map((variante) => ({
        size: variante.size,
        sku: variante.sku,
        priceCents: variante.priceCents,
        stock: variante.stock,
        weightGrams: variante.weightGrams ?? null,
      })),
    },
  });

  await recordAudit(
    {
      actorId: context.actor.id,
      action: AUDIT_ACTIONS.productCreated,
      entityType: "Product",
      entityId: creado.id,
      metadata: { nombre: creado.name, slug: creado.slug, estado: creado.status },
      ip: context.ip,
      userAgent: context.userAgent,
    },
    context.log,
  );

  return toAdminProduct(creado);
}

// ─── Actualización ───────────────────────────────────────────────────────────

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  context: ActionContext,
) {
  const actual = await repo.findProductById(id);
  if (actual === null) {
    throw new NotFoundError("El producto no existe");
  }

  if (input.slug !== undefined && input.slug !== actual.slug) {
    const ocupado = await repo.findProductBySlug(input.slug);
    if (ocupado !== null) {
      throw new ConflictError("Ese slug ya está en uso por otro producto");
    }
  }

  if (input.categoryId !== undefined && input.categoryId !== null) {
    await verificarCategoria(input.categoryId);
  }

  // Las variantes y el producto se guardan juntos: si algo falla a mitad, no
  // queremos un producto actualizado con variantes viejas.
  await prisma.$transaction(async () => {
    const actualizado = await repo.updateProductIfUnchanged(
      id,
      // La marca que envió el CLIENTE, no la que acabamos de leer de la base:
      // comparar la base contra sí misma siempre coincide y la protección no
      // haría nada.
      new Date(input.expectedUpdatedAt),
      {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        // Reclasificar afecta solo a ventas futuras: los pedidos ya emitidos
        // llevan su propia tasa congelada en `OrderItem.taxRateBpsSnapshot`.
        ...(input.taxRateBps === undefined ? {} : { taxRateBps: input.taxRateBps }),
      },
    );

    // null significa que la marca de tiempo no coincidió: otro admin guardó
    // mientras este tenía el formulario abierto.
    if (actualizado === null) {
      throw new ConflictError(
        "Otra persona editó este producto mientras trabajabas. Recarga para ver los cambios.",
      );
    }

    if (input.variants !== undefined) {
      await sincronizarVariantes(id, actual, input.variants);
    }
  });

  const resultado = await repo.findProductById(id);
  if (resultado === null) {
    throw new NotFoundError("El producto no existe");
  }

  await recordAudit(
    {
      actorId: context.actor.id,
      action: AUDIT_ACTIONS.productUpdated,
      entityType: "Product",
      entityId: id,
      // Se anota QUÉ campos cambiaron, no sus valores: el registro no debe
      // convertirse en una copia de la base de datos.
      metadata: { campos: Object.keys(input).filter((k) => k !== "expectedUpdatedAt") },
      ip: context.ip,
      userAgent: context.userAgent,
    },
    context.log,
  );

  return toAdminProduct(resultado);
}

/**
 * Aplica los cambios de variantes: crea las nuevas, actualiza las existentes y
 * archiva las que ya no vienen en la lista.
 */
async function sincronizarVariantes(
  productId: string,
  actual: AdminProduct,
  entrantes: UpdateProductInput["variants"],
): Promise<void> {
  if (entrantes === undefined) return;

  const idsEntrantes = new Set(
    entrantes.map((v) => v.id).filter((id): id is string => id !== undefined),
  );

  // Las que desaparecieron de la lista se archivan, no se borran: pueden estar
  // referenciadas en pedidos antiguos.
  for (const existente of actual.variants) {
    if (!idsEntrantes.has(existente.id)) {
      await repo.softDeleteVariant(existente.id);
    }
  }

  for (const variante of entrantes) {
    if (variante.id === undefined) {
      if (
        variante.size === undefined ||
        variante.sku === undefined ||
        variante.priceCents === undefined
      ) {
        throw new ValidationError("Una variante nueva necesita tamaño, SKU y precio");
      }
      await verificarSkusLibres([variante.sku]);
      await repo.createVariant({
        productId,
        size: variante.size,
        sku: variante.sku,
        priceCents: variante.priceCents,
        stock: variante.stock ?? 0,
        weightGrams: variante.weightGrams ?? null,
      });
      continue;
    }

    await repo.updateVariant(variante.id, {
      ...(variante.size === undefined ? {} : { size: variante.size }),
      ...(variante.sku === undefined ? {} : { sku: variante.sku }),
      ...(variante.priceCents === undefined ? {} : { priceCents: variante.priceCents }),
      ...(variante.stock === undefined ? {} : { stock: variante.stock }),
      ...(variante.weightGrams === undefined
        ? {}
        : { weightGrams: variante.weightGrams }),
    });
  }
}

// ─── Archivado ───────────────────────────────────────────────────────────────

export async function archiveProduct(id: string, context: ActionContext) {
  const producto = await repo.findProductById(id);
  if (producto === null) {
    throw new NotFoundError("El producto no existe");
  }

  await repo.archiveProduct(id);

  await recordAudit(
    {
      actorId: context.actor.id,
      action: AUDIT_ACTIONS.productArchived,
      entityType: "Product",
      entityId: id,
      metadata: { nombre: producto.name },
      ip: context.ip,
      userAgent: context.userAgent,
    },
    context.log,
  );
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export async function createCategory(input: CreateCategoryInput) {
  const slug = await slugCategoriaDisponible(input.slug ?? slugify(input.name));

  if (input.parentId !== undefined && input.parentId !== null) {
    await verificarCategoria(input.parentId);
  }

  return repo.createCategory({
    name: input.name,
    slug,
    parentId: input.parentId ?? null,
    position: input.position,
  });
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

async function verificarSkusLibres(skus: string[]): Promise<void> {
  const repetidos = skus.filter((sku, i) => skus.indexOf(sku) !== i);
  if (repetidos.length > 0) {
    throw new ValidationError(`SKU repetido en la petición: ${repetidos[0] ?? ""}`);
  }

  for (const sku of skus) {
    const existente = await repo.findVariantBySku(sku);
    if (existente !== null) {
      throw new ConflictError(`El SKU ${sku} ya existe en otro producto`);
    }
  }
}

async function verificarCategoria(id: string): Promise<void> {
  const categoria = await repo.categoryExists(id);
  if (categoria === null) {
    throw new ValidationError("La categoría indicada no existe");
  }
}

/** Busca un slug libre añadiendo sufijos: maceta, maceta-2, maceta-3... */
async function slugDisponible(base: string): Promise<string> {
  if (base.length < 3) {
    throw new ValidationError("El nombre es demasiado corto para generar una URL");
  }

  for (let intento = 1; intento <= 50; intento++) {
    const candidato = intento === 1 ? base : slugWithSuffix(base, intento);
    const ocupado = await repo.findProductBySlug(candidato);
    if (ocupado === null) return candidato;
  }

  throw new ConflictError("No se pudo generar una URL libre para este producto");
}

async function slugCategoriaDisponible(base: string): Promise<string> {
  for (let intento = 1; intento <= 50; intento++) {
    const candidato = intento === 1 ? base : slugWithSuffix(base, intento);
    const ocupado = await repo.findCategoryBySlug(candidato);
    if (ocupado === null) return candidato;
  }
  throw new ConflictError("No se pudo generar una URL libre para esta categoría");
}

/** Traduce la fila de la base a lo que expone la API del panel. */
export function toAdminProduct(producto: AdminProduct) {
  return {
    id: producto.id,
    name: producto.name,
    slug: producto.slug,
    description: producto.description,
    status: producto.status,
    taxRateBps: producto.taxRateBps,
    categoryId: producto.categoryId,
    categoryName: producto.category?.name ?? null,
    variants: producto.variants.map((variante) => ({
      id: variante.id,
      size: variante.size,
      sku: variante.sku,
      priceCents: variante.priceCents,
      priceFormatted: formatMoney(variante.priceCents),
      stock: variante.stock,
      weightGrams: variante.weightGrams,
    })),
    images: producto.images.map((imagen) => ({
      id: imagen.id,
      url: imagen.url,
      alt: imagen.alt,
    })),
    // A diferencia del catálogo público, el panel SÍ ve el inventario exacto.
    totalStock: producto.variants.reduce((suma, v) => suma + v.stock, 0),
    createdAt: producto.createdAt.toISOString(),
    updatedAt: producto.updatedAt.toISOString(),
  };
}
