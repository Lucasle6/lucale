/**
 * Contratos del carrito, compartidos entre la API y la tienda.
 *
 * LO IMPORTANTE ES LO QUE NO ESTÁ AQUÍ: ninguna entrada acepta un precio.
 *
 * El cliente solo puede decir "quiero N unidades de la variante X". No tiene
 * dónde poner un importe, ni siquiera si quisiera. El servidor lee el precio
 * de la base de datos y calcula el total en cada petición.
 *
 * Sin esa regla, cualquiera abre las herramientas del navegador, cambia 14990
 * por 1 y compra el catálogo a un centavo. Es la vulnerabilidad más cara de un
 * e-commerce (control de seguridad nº 18).
 */

import { z } from "zod";

/** Tope por línea: evita pedidos absurdos y agotar el inventario por error. */
const MAX_QUANTITY = 50;

export const addToCartSchema = z.object({
  variantId: z.uuid(),
  quantity: z.int().min(1).max(MAX_QUANTITY).default(1),
});

export const updateCartItemSchema = z.object({
  // 0 elimina la línea: evita tener un endpoint aparte para quitar.
  quantity: z.int().min(0).max(MAX_QUANTITY),
});

export const cartItemParamsSchema = z.object({
  itemId: z.uuid(),
});

// ─── Salidas ─────────────────────────────────────────────────────────────────

export const cartLineSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  size: z.string(),
  imageUrl: z.string().nullable(),
  quantity: z.int(),
  /** Precio leído de la base AHORA, no el que el cliente vio al añadirlo. */
  unitPriceCents: z.int(),
  unitPriceFormatted: z.string(),
  lineTotalCents: z.int(),
  lineTotalFormatted: z.string(),
  /**
   * Tasa de IVA del producto en puntos base (0 alimentos, 1600 el resto).
   *
   * Viaja al cliente para que la tienda pueda mostrar el mismo total que va a
   * cobrar el servidor. Es un dato de SALIDA: no existe ninguna entrada donde
   * el cliente pueda proponer una tasa, igual que no puede proponer un precio.
   */
  taxRateBps: z.int(),
  /** Unidades disponibles, para poder avisar si el stock bajó. */
  availableStock: z.int(),
  /** true si la cantidad pedida ya no cabe en el inventario. */
  exceedsStock: z.boolean(),
});

export const cartSchema = z.object({
  lines: z.array(cartLineSchema),
  itemCount: z.int(),
  subtotalCents: z.int(),
  subtotalFormatted: z.string(),
  /** true si alguna línea quedó por encima del stock disponible. */
  hasIssues: z.boolean(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CartLine = z.infer<typeof cartLineSchema>;
export type Cart = z.infer<typeof cartSchema>;
