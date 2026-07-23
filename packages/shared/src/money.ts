/**
 * Todo el dinero de este proyecto se representa en **centavos enteros**.
 *
 * Nunca `number` con decimales. En coma flotante, `0.1 + 0.2 === 0.30000000000000004`,
 * y en una tienda eso es un descuadre contable que aparece meses después y nadie
 * sabe explicar. Un entero de centavos no tiene ese problema: 10 + 20 === 30.
 *
 * La conversión a algo legible ocurre solo en el borde, al mostrarlo en pantalla.
 */

/** Importe en centavos. Alias semántico: hace obvio en las firmas qué unidad se espera. */
export type Cents = number;

export const SUPPORTED_CURRENCIES = ["MXN"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Convierte un importe escrito por una persona ("149.90") a centavos.
 * Se usa solo en la frontera de entrada: formularios del admin, importación de datos.
 */
export function toCents(amount: number): Cents {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Importe no finito: ${String(amount)}`);
  }
  // Math.round y no Math.trunc: 1.005 * 100 da 100.49999... en coma flotante,
  // así que truncar perdería un centavo.
  return Math.round(amount * 100);
}

/** Convierte centavos a unidades. Solo para mostrar o exportar, nunca para calcular. */
export function fromCents(cents: Cents): number {
  return cents / 100;
}

/**
 * Formatea un importe para mostrarlo al usuario: 14990 → "$149.90".
 * Delega en Intl, que se encarga del separador de miles y el símbolo por región.
 */
export function formatMoney(
  cents: Cents,
  currency: Currency = "MXN",
  locale = "es-MX",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(fromCents(cents));
}

/** Suma una lista de importes. Trivial hoy, pero centraliza dónde se toca el dinero. */
export function sumCents(amounts: readonly Cents[]): Cents {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** Total de una línea de pedido: precio unitario × cantidad. */
export function lineTotal(unitPriceCents: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError(`Cantidad inválida: ${String(quantity)}`);
  }
  return unitPriceCents * quantity;
}
