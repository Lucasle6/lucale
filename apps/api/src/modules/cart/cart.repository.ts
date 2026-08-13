/**
 * Acceso a datos del carrito.
 */

import { Prisma, prisma } from "@bodegon/db";

/**
 * Las líneas se traen SIEMPRE con la variante y su producto.
 *
 * Ese `include` no es comodidad: es de donde sale el precio. La línea solo
 * guarda variantId y quantity, así que el importe hay que leerlo de la
 * variante en cada consulta.
 */
const cartInclude = {
  items: {
    orderBy: { createdAt: Prisma.SortOrder.asc },
    include: {
      variant: {
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              status: true,
              deletedAt: true,
              // La tasa de IVA se lee junto al precio y por el mismo motivo:
              // ambos son del catálogo, y ninguno de los dos llega del cliente.
              taxRateBps: true,
              images: { orderBy: { position: Prisma.SortOrder.asc }, take: 1 },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export function findCartByUser(userId: string): Promise<CartWithItems | null> {
  return prisma.cart.findUnique({ where: { userId }, include: cartInclude });
}

export function findCartBySession(sessionToken: string): Promise<CartWithItems | null> {
  return prisma.cart.findUnique({ where: { sessionToken }, include: cartInclude });
}

export function createCart(data: {
  userId?: string | undefined;
  sessionToken?: string | undefined;
  expiresAt: Date;
}): Promise<CartWithItems> {
  return prisma.cart.create({
    data: {
      userId: data.userId ?? null,
      sessionToken: data.sessionToken ?? null,
      expiresAt: data.expiresAt,
    },
    include: cartInclude,
  });
}

/**
 * Los tipos se anotan explícitamente porque el inferido referencia módulos
 * internos del runtime de Prisma y TypeScript no lo puede nombrar de forma
 * portable.
 */
export type VariantForCart = Prisma.ProductVariantGetPayload<{
  include: { product: { select: { status: true; deletedAt: true } } };
}>;

export function findVariantForCart(variantId: string): Promise<VariantForCart | null> {
  return prisma.productVariant.findFirst({
    where: { id: variantId, deletedAt: null },
    include: { product: { select: { status: true, deletedAt: true } } },
  });
}

/**
 * Añade una unidad o incrementa la existente, en una sola operación.
 *
 * `upsert` sobre la restricción única (cartId, variantId) del Día 2: si la
 * variante ya está en el carrito, suma; si no, crea la línea. Sin esa
 * restricción habría que leer primero y decidir después, con la carrera
 * clásica de dos peticiones simultáneas creando dos líneas de lo mismo.
 */
export function upsertItem(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<{ id: string }> {
  return prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity },
    update: { quantity: { increment: quantity } },
    select: { id: true },
  });
}

export function findItem(
  itemId: string,
): Promise<{ id: string; cartId: string; variantId: string } | null> {
  return prisma.cartItem.findUnique({
    where: { id: itemId },
    select: { id: true, cartId: true, variantId: true },
  });
}

export function setItemQuantity(
  itemId: string,
  quantity: number,
): Promise<{ id: string }> {
  return prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
    select: { id: true },
  });
}

export function deleteItem(itemId: string): Promise<{ id: string }> {
  return prisma.cartItem.delete({ where: { id: itemId }, select: { id: true } });
}

export function clearCart(cartId: string): Promise<{ count: number }> {
  return prisma.cartItem.deleteMany({ where: { cartId } });
}

/**
 * Traspasa las líneas de un carrito a otro y borra el de origen.
 *
 * Se usa al iniciar sesión: lo que el invitado había puesto se une a lo que ya
 * tenía en su cuenta. Va en transacción porque a mitad de camino el carrito
 * quedaría partido entre los dos.
 */
export async function mergeCarts(desdeId: string, haciaId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const origen = await tx.cartItem.findMany({ where: { cartId: desdeId } });

    for (const linea of origen) {
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: haciaId, variantId: linea.variantId } },
        create: {
          cartId: haciaId,
          variantId: linea.variantId,
          quantity: linea.quantity,
        },
        // Si ya tenía esa variante, se suman las cantidades.
        update: { quantity: { increment: linea.quantity } },
      });
    }

    await tx.cart.delete({ where: { id: desdeId } });
  });
}

export function attachCartToUser(
  cartId: string,
  userId: string,
): Promise<{ id: string }> {
  return prisma.cart.update({
    where: { id: cartId },
    data: { userId, sessionToken: null },
    select: { id: true },
  });
}
