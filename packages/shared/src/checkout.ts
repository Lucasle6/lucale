/**
 * Contratos y reglas de dinero del checkout.
 *
 * Igual que en el carrito, LO IMPORTANTE ES LO QUE NO ESTÁ AQUÍ: la entrada del
 * checkout no acepta ni un solo importe. El cliente manda a dónde enviar y a
 * qué correo avisar. Cuánto cuesta lo decide el servidor releyendo la base de
 * datos (control de seguridad nº 18).
 *
 * Las funciones de cálculo viven en este paquete, y no en la API, para que la
 * tienda pueda enseñar el mismo total ANTES de pagar sin reimplementar la
 * fórmula. Dos implementaciones del mismo cálculo acaban divergiendo, y el día
 * que diverjan el cliente ve un precio y se le cobra otro.
 */

import { z } from "zod";
import type { Cents } from "./money.js";

// ─── Reglas de envío ─────────────────────────────────────────────────────────

/** A partir de este subtotal el envío va incluido. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 99_900; // $999.00 MXN

/** Tarifa plana de envío nacional por debajo del umbral. */
export const FLAT_SHIPPING_CENTS = 9_900; // $99.00 MXN

export function calculateShipping(subtotalCents: Cents): Cents {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
}

/**
 * Cuánto falta para el envío gratis. 0 si ya lo alcanzó.
 * Lo usa la tienda para el clásico "te faltan $120 para envío gratis".
 */
export function amountUntilFreeShipping(subtotalCents: Cents): Cents {
  return Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents);
}

// ─── IVA ─────────────────────────────────────────────────────────────────────

/**
 * En México los precios al consumidor se muestran CON IVA incluido: lo exige la
 * Ley Federal de Protección al Consumidor. Si una salsa dice $180, el cliente
 * paga $180 — no $208.80.
 *
 * Así que el IVA no se SUMA al total: se EXTRAE de él, para poder declararlo.
 *
 *   total = base + IVA           y      IVA = base × tasa
 *   ⇒ total = base × (1 + tasa)  ⇒      IVA = total × tasa/(1 + tasa)
 *
 * Esa es la diferencia entre `total × 0.16` (mal: cobra de más) y
 * `total × 16/116` (bien: reparte lo que ya se cobró).
 */

/** Tasa general. 1600 puntos base = 16%. */
export const TAX_RATE_STANDARD_BPS = 1600;

/**
 * Tasa 0%: productos destinados a la alimentación humana (art. 2-A de la Ley
 * del IVA). Salsas, aceites comestibles y despensa entran aquí.
 *
 * Tasa 0% NO es lo mismo que "exento": con tasa 0 el vendedor sigue pudiendo
 * acreditar el IVA que pagó a sus proveedores. Por eso se modela como una tasa
 * de verdad y no como una ausencia.
 */
export const TAX_RATE_ZERO_BPS = 0;

/**
 * Tasa del ENVÍO.
 *
 * El flete es un servicio de transporte, no un alimento, así que en principio
 * causa 16% aunque lo que viaje en la caja sea de tasa 0.
 *
 * Está aparte y con nombre propio justo porque es la parte discutible: según
 * cómo se facture el envío, hay criterios distintos. Cuando tu contador lo
 * confirme, se cambia este único valor y todo el sistema se entera. Lo incierto
 * se deja configurable y a la vista, no clavado dentro de una fórmula.
 */
export const SHIPPING_TAX_RATE_BPS = TAX_RATE_STANDARD_BPS;

/** Denominador de puntos base: 10 000 bps = 100%. */
const BPS = 10_000;

/**
 * IVA contenido en un importe que YA lo incluye, a la tasa dada.
 *
 * Se multiplica antes de dividir a propósito: la cuenta opera sobre enteros
 * hasta el último paso, mientras que `x * 0.16 / 1.16` arrastra el error de
 * 0.16, que en binario no es exacto. Con dinero, esa diferencia se acumula y
 * aparece meses después como un descuadre de centavos.
 */
export function taxIncludedIn(grossCents: Cents, rateBps: number): Cents {
  if (rateBps === 0) return 0;
  return Math.round((grossCents * rateBps) / (BPS + rateBps));
}

// ─── Totales ─────────────────────────────────────────────────────────────────

export interface OrderTotals {
  /** Suma de las líneas, con IVA ya incluido. */
  subtotalCents: Cents;
  /** Envío, con IVA ya incluido (el flete también causa IVA). */
  shippingCents: Cents;
  /**
   * IVA CONTENIDO en el total. Es informativo, para la factura y la declaración.
   *
   * ⚠️  NO se suma al total. Si lo sumaras, cobrarías el impuesto dos veces.
   */
  taxCents: Cents;
  /** Lo que se le cobra realmente a la tarjeta. */
  totalCents: Cents;
}

/** Lo mínimo que hace falta de una línea para calcular su impuesto. */
export interface TaxableLine {
  lineTotalCents: Cents;
  /** Tasa del producto en puntos base: 0 para alimentos, 1600 para lo demás. */
  taxRateBps: number;
}

/**
 * Única fuente de verdad de la aritmética del pedido.
 *
 * ⚠️  DOS COSAS QUE PARECEN ERRORES Y NO LO SON:
 *
 *  1) El total no incluye el impuesto como sumando:
 *
 *        totalCents = subtotalCents + shippingCents
 *        totalCents ≠ subtotalCents + shippingCents + taxCents
 *
 *     `taxCents` ya está DENTRO de los otros dos. Sumarlo cobraría dos veces.
 *
 *  2) El IVA se calcula LÍNEA POR LÍNEA y luego se suma, en vez de aplicarse
 *     una tasa al total. Con un catálogo mixto —salsas al 0% y utensilios al
 *     16%— no existe ninguna tasa única que describa el pedido: aplicar una al
 *     total daría un número inventado. Cada línea sabe la suya.
 */
export function calculateTotals(lines: readonly TaxableLine[]): OrderTotals {
  // Sin líneas no hay nada que enviar, así que tampoco hay envío que cobrar.
  // El checkout ya rechaza los carritos vacíos antes de llegar aquí, pero sin
  // esta salida la función devolvería $99 de envío para un pedido de nada — y
  // esa clase de trampa acaba encontrándote desde otra parte del código.
  if (lines.length === 0) {
    return { subtotalCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0 };
  }

  const subtotalCents = lines.reduce((suma, linea) => suma + linea.lineTotalCents, 0);
  const shippingCents = calculateShipping(subtotalCents);

  const impuestoDeLineas = lines.reduce(
    (suma, linea) => suma + taxIncludedIn(linea.lineTotalCents, linea.taxRateBps),
    0,
  );

  return {
    subtotalCents,
    shippingCents,
    // El envío tributa por su cuenta: es un servicio, no la mercancía.
    taxCents: impuestoDeLineas + taxIncludedIn(shippingCents, SHIPPING_TAX_RATE_BPS),
    totalCents: subtotalCents + shippingCents,
  };
}

// ─── Dirección de envío ──────────────────────────────────────────────────────

/**
 * Las 32 entidades federativas. Una lista cerrada, no texto libre: así el admin
 * puede filtrar pedidos por estado sin pelearse con "CDMX", "Ciudad de Mexico",
 * "D.F." y "df" conviviendo en la misma columna.
 */
export const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

export type MexicanState = (typeof MEXICAN_STATES)[number];

/**
 * Dirección mexicana. No es la misma forma que una dirección estadounidense:
 * aquí la COLONIA es imprescindible para repartir, y el número exterior va
 * separado del nombre de la calle.
 */
export const shippingAddressSchema = z.object({
  recipientName: z.string().trim().min(3, "escribe el nombre completo").max(120),

  street: z.string().trim().min(3, "falta la calle").max(120),
  exteriorNumber: z.string().trim().min(1, "falta el número exterior").max(20),
  interiorNumber: z.string().trim().max(20).optional(),

  neighborhood: z.string().trim().min(2, "falta la colonia").max(120),
  city: z.string().trim().min(2, "falta la ciudad o municipio").max(120),
  state: z.enum(MEXICAN_STATES, { message: "elige un estado de la lista" }),

  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "el código postal son 5 dígitos"),

  /** El transportista lo pide para avisar de la entrega. */
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length === 10, {
      message: "el teléfono son 10 dígitos",
    }),

  /**
   * "Entre calles", "portón verde", "preguntar por…". En México es lo que
   * decide si el paquete llega o se regresa a la bodega.
   */
  references: z.string().trim().max(300).optional(),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

// ─── Entrada del checkout ────────────────────────────────────────────────────

/**
 * Lo único que el cliente puede decir al pagar.
 *
 * No hay campo para el importe, ni para el envío, ni para el descuento. No es
 * que los ignoremos: es que no existen en el contrato, así que ni el cliente
 * más creativo tiene dónde escribirlos.
 */
export const checkoutSchema = z.object({
  /**
   * Se pide siempre, incluso con sesión iniciada: es a donde va el recibo, y
   * permite comprar sin cuenta. Por eso `Order.email` no es opcional aunque
   * `Order.userId` sí lo sea.
   */
  /**
   * Se limpia ANTES de validar, no después. Al revés, un correo con un espacio
   * de más se rechaza por "formato inválido" sin llegar nunca a limpiarse — y
   * el cliente se queda sin poder pagar por un espacio invisible.
   */
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("no parece un correo válido").max(254)), // 254 = RFC 5321

  shippingAddress: shippingAddressSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ─── Salida del checkout ─────────────────────────────────────────────────────

export const checkoutSessionSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  /** URL de la pantalla de pago de Stripe. El cliente se redirige aquí. */
  checkoutUrl: z.url(),
});

export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;

// ─── Resumen para pintar antes de pagar ──────────────────────────────────────

export const orderTotalsSchema = z.object({
  subtotalCents: z.int(),
  subtotalFormatted: z.string(),
  shippingCents: z.int(),
  shippingFormatted: z.string(),
  taxCents: z.int(),
  taxFormatted: z.string(),
  totalCents: z.int(),
  totalFormatted: z.string(),
  /** 0 si el envío ya salió gratis. */
  untilFreeShippingCents: z.int(),
});

export type OrderTotalsView = z.infer<typeof orderTotalsSchema>;
