/**
 * Reglas de negocio del carrito.
 *
 * LA REGLA CENTRAL: los precios se leen de la base de datos en CADA cálculo.
 * Nunca llegan del cliente, y tampoco se guardan en la línea del carrito.
 *
 * Consecuencias buenas de eso, además de la seguridad: si el admin cambia un
 * precio, el carrito del cliente se actualiza solo la próxima vez que lo mire.
 * No hay precios "congelados" que discutir. La congelación ocurre en la ORDEN
 * (Día 2), que es donde debe ocurrir.
 */

import { ProductStatus } from "@bodegon/db";
import { formatMoney, lineTotal, sumCents } from "@bodegon/shared";
import type { Cart, CartLine } from "@bodegon/shared";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import * as repo from "./cart.repository.js";
import type { CartWithItems } from "./cart.repository.js";

/** Cuánto vive un carrito de invitado antes de poder limpiarse. */
const GUEST_CART_DAYS = 30;

function caducidad(): Date {
  return new Date(Date.now() + GUEST_CART_DAYS * 24 * 60 * 60 * 1000);
}

/** Identifica de quién es el carrito: usuario con sesión o invitado. */
export type CartOwner =
  { tipo: "usuario"; userId: string } | { tipo: "invitado"; sessionToken: string };

// ─── Lectura ─────────────────────────────────────────────────────────────────

async function buscarCarrito(owner: CartOwner): Promise<CartWithItems | null> {
  return owner.tipo === "usuario"
    ? repo.findCartByUser(owner.userId)
    : repo.findCartBySession(owner.sessionToken);
}

async function obtenerOCrear(owner: CartOwner): Promise<CartWithItems> {
  const existente = await buscarCarrito(owner);
  if (existente !== null) return existente;

  return repo.createCart({
    ...(owner.tipo === "usuario"
      ? { userId: owner.userId }
      : { sessionToken: owner.sessionToken }),
    expiresAt: caducidad(),
  });
}

export async function getCart(owner: CartOwner): Promise<Cart> {
  const carrito = await buscarCarrito(owner);
  if (carrito === null) return carritoVacio();
  return calcular(carrito);
}

/**
 * Convierte las filas en el carrito que ve el cliente.
 *
 * Aquí es donde se leen los precios: de `linea.variant.priceCents`, es decir,
 * de la base de datos, en este mismo instante. El cliente nunca los envía.
 */
function calcular(carrito: CartWithItems): Cart {
  const lines: CartLine[] = carrito.items
    // Un producto archivado o borrado deja de contar aunque siga en la fila:
    // no se puede comprar algo que ya no está a la venta.
    .filter(
      (item) =>
        item.variant.deletedAt === null &&
        item.variant.product.deletedAt === null &&
        item.variant.product.status === ProductStatus.ACTIVE,
    )
    .map((item) => {
      const unitPriceCents = item.variant.priceCents;
      const total = lineTotal(unitPriceCents, item.quantity);

      return {
        id: item.id,
        variantId: item.variantId,
        productName: item.variant.product.name,
        productSlug: item.variant.product.slug,
        size: item.variant.size,
        imageUrl: item.variant.product.images[0]?.url ?? null,
        quantity: item.quantity,
        unitPriceCents,
        unitPriceFormatted: formatMoney(unitPriceCents),
        lineTotalCents: total,
        lineTotalFormatted: formatMoney(total),
        availableStock: item.variant.stock,
        // Si el stock bajó desde que se añadió, se avisa en vez de fallar al
        // pagar. Mejor enterarse aquí que en el checkout.
        exceedsStock: item.quantity > item.variant.stock,
      };
    });

  const subtotalCents = sumCents(lines.map((l) => l.lineTotalCents));

  return {
    lines,
    itemCount: lines.reduce((suma, l) => suma + l.quantity, 0),
    subtotalCents,
    subtotalFormatted: formatMoney(subtotalCents),
    hasIssues: lines.some((l) => l.exceedsStock),
  };
}

function carritoVacio(): Cart {
  return {
    lines: [],
    itemCount: 0,
    subtotalCents: 0,
    subtotalFormatted: formatMoney(0),
    hasIssues: false,
  };
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

export async function addItem(
  owner: CartOwner,
  variantId: string,
  quantity: number,
): Promise<Cart> {
  const variante = await repo.findVariantForCart(variantId);

  // Mismo 404 para "no existe" y "no está publicado": el catálogo público no
  // debe poder usarse para averiguar qué borradores hay.
  if (
    variante === null ||
    variante.product.deletedAt !== null ||
    variante.product.status !== ProductStatus.ACTIVE
  ) {
    throw new NotFoundError("Ese producto no está disponible");
  }

  const carrito = await obtenerOCrear(owner);

  // Se comprueba el total resultante, no solo lo que se añade: si ya había 3 y
  // se piden 4 más, lo que importa es que 7 quepan en el inventario.
  const yaEnCarrito = carrito.items.find((i) => i.variantId === variantId)?.quantity ?? 0;

  if (yaEnCarrito + quantity > variante.stock) {
    throw new ConflictError(
      variante.stock === 0
        ? "Ese tamaño está agotado"
        : `Solo quedan ${String(variante.stock)} unidades de ese tamaño`,
    );
  }

  await repo.upsertItem(carrito.id, variantId, quantity);
  return getCart(owner);
}

export async function updateItem(
  owner: CartOwner,
  itemId: string,
  quantity: number,
): Promise<Cart> {
  const carrito = await buscarCarrito(owner);
  if (carrito === null) {
    throw new NotFoundError("No tienes un carrito abierto");
  }

  // Comprobación de propiedad: sin esto, alguien podría modificar la línea de
  // OTRO carrito pasando su id (IDOR, control de seguridad nº 16).
  const linea = carrito.items.find((i) => i.id === itemId);
  if (linea === undefined) {
    throw new NotFoundError("Ese artículo no está en tu carrito");
  }

  if (quantity === 0) {
    await repo.deleteItem(itemId);
    return getCart(owner);
  }

  if (quantity > linea.variant.stock) {
    throw new ConflictError(
      `Solo quedan ${String(linea.variant.stock)} unidades de ese tamaño`,
    );
  }

  await repo.setItemQuantity(itemId, quantity);
  return getCart(owner);
}

export async function removeItem(owner: CartOwner, itemId: string): Promise<Cart> {
  return updateItem(owner, itemId, 0);
}

export async function clear(owner: CartOwner): Promise<Cart> {
  const carrito = await buscarCarrito(owner);
  if (carrito !== null) {
    await repo.clearCart(carrito.id);
  }
  return carritoVacio();
}

// ─── Fusión al iniciar sesión ────────────────────────────────────────────────

/**
 * Une el carrito de invitado con el de la cuenta.
 *
 * Escenario real: alguien navega sin cuenta, mete tres piezas, y entonces
 * inicia sesión para pagar. Sin esto, su carrito desaparecería en el momento
 * exacto en que iba a comprar — y con él, la venta.
 */
export async function mergeGuestCart(
  sessionToken: string,
  userId: string,
): Promise<void> {
  const invitado = await repo.findCartBySession(sessionToken);
  if (invitado === null || invitado.items.length === 0) return;

  const delUsuario = await repo.findCartByUser(userId);

  if (delUsuario === null) {
    // No tenía carrito: el de invitado pasa a ser suyo, sin mover líneas.
    await repo.attachCartToUser(invitado.id, userId);
    return;
  }

  await repo.mergeCarts(invitado.id, delUsuario.id);
}

/** Valida el carrito antes de cobrar. Se usará en el checkout (Día 11). */
export async function assertPurchasable(owner: CartOwner): Promise<Cart> {
  const carrito = await getCart(owner);

  if (carrito.lines.length === 0) {
    throw new ValidationError("Tu carrito está vacío");
  }
  if (carrito.hasIssues) {
    throw new ConflictError(
      "Algunos artículos superan el stock disponible. Revisa tu carrito.",
    );
  }

  return carrito;
}
