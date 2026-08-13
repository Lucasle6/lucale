/**
 * Aritmética del checkout.
 *
 * Es el código más delicado del proyecto: decide cuánto se le cobra a una
 * persona y cuánto declaras al SAT. Un error aquí no lanza ninguna excepción
 * —simplemente cobra mal, en silencio, en cada venta— así que se prueba con
 * números concretos y comprobaciones cruzadas, no con "parece que funciona".
 */

import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_TAX_RATE_BPS,
  TAX_RATE_STANDARD_BPS,
  TAX_RATE_ZERO_BPS,
  amountUntilFreeShipping,
  calculateShipping,
  calculateTotals,
  checkoutSchema,
  taxIncludedIn,
} from "./checkout.js";

// ─── El IVA se extrae, no se suma ────────────────────────────────────────────

describe("taxIncludedIn", () => {
  it("extrae el IVA de un importe que ya lo incluye", () => {
    // $500 con IVA dentro: base $431.03 + IVA $68.97.
    expect(taxIncludedIn(50_000, TAX_RATE_STANDARD_BPS)).toBe(6_897);
  });

  it("NO es lo mismo que aplicar el 16% al total", () => {
    const ingenuo = Math.round(50_000 * 0.16); // el error clásico
    const correcto = taxIncludedIn(50_000, TAX_RATE_STANDARD_BPS);

    expect(ingenuo).toBe(8_000);
    expect(correcto).toBe(6_897);
    // Once pesos de sobrecobro por cada quinientos: un 2.2% en TODAS las ventas.
    expect(ingenuo - correcto).toBe(1_103);
  });

  it("devuelve cero a tasa cero", () => {
    expect(taxIncludedIn(18_000, TAX_RATE_ZERO_BPS)).toBe(0);
    expect(taxIncludedIn(999_999, TAX_RATE_ZERO_BPS)).toBe(0);
  });

  it("es consistente al revés: base + IVA reconstruye el total", () => {
    // La prueba de fuego del reparto: si a la base le aplicas la tasa, tiene
    // que salir el mismo IVA que extrajimos (con un centavo de holgura por
    // redondeo). Sin esto, la fórmula podría "funcionar" y repartir mal.
    for (const total of [50_000, 99_999, 123_457, 1, 7, 33]) {
      const iva = taxIncludedIn(total, TAX_RATE_STANDARD_BPS);
      const base = total - iva;
      expect(Math.abs(Math.round(base * 0.16) - iva)).toBeLessThanOrEqual(1);
    }
  });

  it("nunca devuelve más que el propio importe", () => {
    for (const importe of [1, 2, 3, 99, 100_000_000]) {
      expect(taxIncludedIn(importe, TAX_RATE_STANDARD_BPS)).toBeLessThan(importe);
    }
  });
});

// ─── Envío ───────────────────────────────────────────────────────────────────

describe("calculateShipping", () => {
  it("cobra envío por debajo del umbral y no cobra a partir de él", () => {
    // El borde exacto: aquí es donde viven los errores de > contra >=.
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD_CENTS - 1)).toBe(9_900);
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD_CENTS)).toBe(0);
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD_CENTS + 1)).toBe(0);
  });

  it("calcula cuánto falta para el envío gratis, sin bajar de cero", () => {
    expect(amountUntilFreeShipping(FREE_SHIPPING_THRESHOLD_CENTS - 100)).toBe(100);
    expect(amountUntilFreeShipping(FREE_SHIPPING_THRESHOLD_CENTS)).toBe(0);
    // Si ya lo superó, "faltan 0" — nunca un negativo que la tienda pintaría
    // como "te faltan -$500 para el envío gratis".
    expect(amountUntilFreeShipping(500_000)).toBe(0);
  });
});

// ─── Totales con tasas mixtas ────────────────────────────────────────────────

describe("calculateTotals", () => {
  /** Carrito real: dos salsas (alimento, 0%) y una cuchara (utensilio, 16%). */
  const mixto = [
    { lineTotalCents: 36_000, taxRateBps: TAX_RATE_ZERO_BPS },
    { lineTotalCents: 9_500, taxRateBps: TAX_RATE_STANDARD_BPS },
  ];

  it("suma el IVA línea por línea, no aplicando una tasa al total", () => {
    const t = calculateTotals(mixto);

    expect(t.subtotalCents).toBe(45_500);
    expect(t.shippingCents).toBe(9_900);
    expect(t.totalCents).toBe(55_400);

    // 0 (salsa) + 1310 (cuchara) + 1366 (envío) = 2676
    expect(t.taxCents).toBe(2_676);
  });

  it("difiere mucho de aplicar una tasa global, que es el error a evitar", () => {
    const t = calculateTotals(mixto);
    const conTasaGlobal = taxIncludedIn(t.totalCents, TAX_RATE_STANDARD_BPS);

    expect(conTasaGlobal).toBe(7_641);
    // Casi tres veces más: declararías $49.65 de IVA que no cobraste.
    expect(conTasaGlobal - t.taxCents).toBe(4_965);
  });

  it("el impuesto NO forma parte del total", () => {
    const t = calculateTotals(mixto);

    // Esta es la afirmación que parece un bug y no lo es: el IVA ya está
    // dentro del subtotal y del envío. Sumarlo cobraría dos veces.
    expect(t.totalCents).toBe(t.subtotalCents + t.shippingCents);
    expect(t.totalCents).not.toBe(t.subtotalCents + t.shippingCents + t.taxCents);
  });

  it("cobra IVA del envío aunque todo lo que se envíe sea alimento", () => {
    // El flete es un servicio de transporte, no comida: tributa por su cuenta.
    const soloAlimentos = [{ lineTotalCents: 50_000, taxRateBps: TAX_RATE_ZERO_BPS }];
    const t = calculateTotals(soloAlimentos);

    expect(t.shippingCents).toBe(9_900);
    expect(t.taxCents).toBe(taxIncludedIn(9_900, SHIPPING_TAX_RATE_BPS));
    expect(t.taxCents).toBe(1_366);
  });

  it("no cobra IVA de envío cuando el envío es gratis", () => {
    const grande = [{ lineTotalCents: 150_000, taxRateBps: TAX_RATE_ZERO_BPS }];
    const t = calculateTotals(grande);

    expect(t.shippingCents).toBe(0);
    expect(t.taxCents).toBe(0);
  });

  it("con el carrito vacío todo vale cero, sin cobrar envío fantasma", () => {
    // Escribir esta prueba fue lo que destapó el caso: la versión anterior
    // devolvía $99 de envío para un pedido sin nada dentro, porque un subtotal
    // de 0 no alcanza el umbral de envío gratis. Inalcanzable hoy —el service
    // rechaza los carritos vacíos antes—, pero es la clase de trampa que
    // aparece el día que otro código llame a esta función.
    const t = calculateTotals([]);

    expect(t.subtotalCents).toBe(0);
    expect(t.shippingCents).toBe(0);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(0);
  });
});

// ─── El contrato de entrada ──────────────────────────────────────────────────

describe("checkoutSchema", () => {
  const direccionValida = {
    recipientName: "José Luis Castañeda",
    street: "Avenida Reforma",
    exteriorNumber: "222",
    neighborhood: "Juárez",
    city: "Cuauhtémoc",
    state: "Ciudad de México",
    postalCode: "06600",
    phone: "55 1234 5678",
  };

  it("acepta un correo con espacios y mayúsculas, y lo normaliza", () => {
    // REGRESIÓN del Día 11: el esquema validaba ANTES de limpiar, así que un
    // correo copiado y pegado con un espacio se rechazaba por "formato
    // inválido". Afectaba también al registro de usuarios.
    const r = checkoutSchema.safeParse({
      email: "  Jose.Prueba@Gmail.COM  ",
      shippingAddress: direccionValida,
    });

    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("jose.prueba@gmail.com");
  });

  it("no admite ningún importe: el precio no viaja desde el cliente", () => {
    const r = checkoutSchema.safeParse({
      email: "cliente@ejemplo.mx",
      shippingAddress: direccionValida,
      // Lo que intentaría alguien con las herramientas del navegador abiertas.
      totalCents: 1,
      subtotalCents: 1,
      shippingCents: 0,
    });

    expect(r.success).toBe(true);
    // Los campos no se rechazan: se DESCARTAN. No llegan al service, así que
    // no hay forma de que influyan en nada.
    expect(r.data).not.toHaveProperty("totalCents");
    expect(Object.keys(r.data ?? {})).toStrictEqual(["email", "shippingAddress"]);
  });

  it("exige los campos que hacen falta para repartir en México", () => {
    const sinColonia = { ...direccionValida, neighborhood: "" };
    const r = checkoutSchema.safeParse({
      email: "cliente@ejemplo.mx",
      shippingAddress: sinColonia,
    });

    expect(r.success).toBe(false);
  });

  it("rechaza un estado que no está en la lista", () => {
    const r = checkoutSchema.safeParse({
      email: "cliente@ejemplo.mx",
      shippingAddress: { ...direccionValida, state: "CDMX" },
    });

    expect(r.success).toBe(false);
  });

  it("acepta el teléfono con espacios pero exige diez dígitos", () => {
    const con = (phone: string) =>
      checkoutSchema.safeParse({
        email: "cliente@ejemplo.mx",
        shippingAddress: { ...direccionValida, phone },
      }).success;

    expect(con("55 1234 5678")).toBe(true);
    expect(con("(55) 1234-5678")).toBe(true);
    expect(con("5512345678")).toBe(true);
    expect(con("551234567")).toBe(false); // nueve
    expect(con("55123456789")).toBe(false); // once
  });

  it("exige cinco dígitos de código postal", () => {
    const con = (postalCode: string) =>
      checkoutSchema.safeParse({
        email: "cliente@ejemplo.mx",
        shippingAddress: { ...direccionValida, postalCode },
      }).success;

    expect(con("06600")).toBe(true);
    expect(con("6600")).toBe(false);
    expect(con("066001")).toBe(false);
    expect(con("06A00")).toBe(false);
  });
});
