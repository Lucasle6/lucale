/**
 * Acceso a datos del checkout.
 */

import { OrderStatus, prisma } from "@bodegon/db";
import type { Prisma } from "@bodegon/db";

/** Cliente dentro de una transacción. Mismos métodos, pero atado al `BEGIN`. */
export type Tx = Prisma.TransactionClient;

// ─── Número de pedido ────────────────────────────────────────────────────────

/**
 * Reserva el siguiente número legible: LCL-2026-1042.
 *
 * `nextval()` es atómico por definición de PostgreSQL: dos compras simultáneas
 * reciben valores distintos sin candados en la aplicación. Es lo que hace
 * imposible la carrera del `count() + 1`.
 *
 * Detalle que sorprende la primera vez: una secuencia NO se revierte con un
 * `ROLLBACK`. Si la transacción falla, ese número se pierde y el siguiente
 * pedido salta un hueco. Es deliberado — así es como la secuencia puede ser
 * atómica sin bloquear a nadie. Un hueco en la numeración no rompe nada; dos
 * pedidos con el mismo número, sí.
 */
export async function nextOrderNumber(tx: Tx): Promise<string> {
  const filas = await tx.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('order_number_seq')
  `;

  const valor = filas[0]?.nextval;
  if (valor === undefined) {
    throw new Error("La secuencia order_number_seq no devolvió ningún valor");
  }

  return `LCL-${String(new Date().getFullYear())}-${String(valor)}`;
}

// ─── Variantes, releídas para congelar ───────────────────────────────────────

const variantForOrderSelect = {
  id: true,
  sku: true,
  size: true,
  priceCents: true,
  stock: true,
  deletedAt: true,
  product: {
    select: { name: true, status: true, deletedAt: true, taxRateBps: true },
  },
} satisfies Prisma.ProductVariantSelect;

export type VariantForOrder = Prisma.ProductVariantGetPayload<{
  select: typeof variantForOrderSelect;
}>;

/**
 * Relee del catálogo las variantes que se van a comprar.
 *
 * Esta es la lectura AUTORITATIVA del precio: la que acaba congelada en la
 * factura. El carrito ya había leído precios para pintarse, pero entre aquella
 * pantalla y este instante pudo pasar cualquier cosa, así que no nos fiamos de
 * ella: preguntamos otra vez.
 */
export function findVariantsForOrder(
  variantIds: readonly string[],
): Promise<VariantForOrder[]> {
  return prisma.productVariant.findMany({
    where: { id: { in: [...variantIds] } },
    select: variantForOrderSelect,
  });
}

// ─── Creación del pedido ─────────────────────────────────────────────────────

/** Una línea ya congelada, lista para escribirse. */
export interface OrderLineInput {
  variantId: string;
  productNameSnapshot: string;
  sizeSnapshot: string;
  skuSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Tasa vigente al vender, congelada. Ver el comentario en el modelo. */
  taxRateBpsSnapshot: number;
  /** IVA contenido en la línea, ya calculado y congelado. */
  taxCents: number;
}

export interface NewOrderInput {
  userId: string | null;
  email: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingAddress: Prisma.InputJsonObject;
  lines: readonly OrderLineInput[];
}

export interface CreatedOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
}

/**
 * Crea el pedido en PENDING con sus líneas, todo o nada.
 *
 * Va en transacción porque un pedido sin líneas es peor que ningún pedido: se
 * vería en el panel como una venta de importe correcto y contenido vacío, y
 * nadie sabría qué había que empaquetar.
 *
 * Lo que NO ocurre aquí: descontar el stock. El inventario se mueve cuando el
 * pago se confirma (Día 12). Descontarlo ahora dejaría piezas retenidas por
 * carritos que nadie llegó a pagar.
 */
export function createPendingOrder(input: NewOrderInput): Promise<CreatedOrder> {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx);

    const orden = await tx.order.create({
      data: {
        orderNumber,
        userId: input.userId,
        email: input.email,
        status: OrderStatus.PENDING,
        subtotalCents: input.subtotalCents,
        shippingCents: input.shippingCents,
        taxCents: input.taxCents,
        totalCents: input.totalCents,
        currency: "MXN",
        shippingAddress: input.shippingAddress,
        items: {
          create: input.lines.map((linea) => ({
            variantId: linea.variantId,
            productNameSnapshot: linea.productNameSnapshot,
            sizeSnapshot: linea.sizeSnapshot,
            skuSnapshot: linea.skuSnapshot,
            unitPriceCents: linea.unitPriceCents,
            quantity: linea.quantity,
            lineTotalCents: linea.lineTotalCents,
            taxRateBpsSnapshot: linea.taxRateBpsSnapshot,
            taxCents: linea.taxCents,
          })),
        },
      },
      select: { id: true, orderNumber: true, totalCents: true },
    });

    return orden;
  });
}

/** Guarda el identificador de la sesión de Stripe una vez creada. */
export function attachStripeSession(
  orderId: string,
  stripeSessionId: string,
): Promise<{ id: string }> {
  return prisma.order.update({
    where: { id: orderId },
    data: { stripeSessionId },
    select: { id: true },
  });
}

/**
 * Cancela un pedido que nunca llegó a la pantalla de pago.
 *
 * Se usa si Stripe falla después de haber creado el pedido: sin esto quedaría
 * un PENDING eterno que ensucia el panel y las métricas de conversión.
 */
export function markCancelled(orderId: string): Promise<{ id: string }> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
    select: { id: true },
  });
}
