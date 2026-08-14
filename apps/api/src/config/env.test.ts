/**
 * Las guardas cruzadas de Stripe.
 *
 * Estas comprobaciones existen para que sea IMPOSIBLE arrancar con el entorno
 * de pago equivocado. Hasta ahora no tenían prueba, y la guarda que faltaba se
 * descubrió en producción: la tienda quedó publicada con la clave real mientras
 * la consola anunciaba en cada reinicio que no cobraba. Se detectó por el
 * prefijo `cs_live_` de una URL de pago, no por ningún aviso nuestro.
 *
 * Se prueba el ESQUEMA, no el módulo ya cargado. `env.ts` valida al importarse
 * y llama a `process.exit(1)` si algo falla, así que darle entornos inválidos
 * al módulo mataría el proceso de pruebas entero. El esquema, en cambio, es una
 * función pura sobre un objeto: se le pueden dar todas las combinaciones malas
 * que queramos y solo devuelve errores.
 */

import { describe, expect, it } from "vitest";
import { EnvSchema } from "./env.js";

/**
 * Claves ficticias. Lo único que el esquema exige es el prefijo, así que no
 * hace falta imitar la forma completa de una clave de Stripe.
 *
 * Y no debe imitarse: la primera versión de este archivo usaba cadenas con
 * pinta de clave real y el escáner de secretos de GitHub rechazó el push. Tenía
 * razón en desconfiar — no puede saber que son inventadas. Lo que corresponde
 * es que los datos de prueba se lean como datos de prueba, no pedirle al
 * escáner que haga una excepción.
 */
const SK_REAL = "sk_live_ficticia_de_prueba";
const SK_PRUEBA = "sk_test_ficticia_de_prueba";

/**
 * Parte de `process.env`, que es válido porque el propio módulo se cargó con
 * él. Construir un entorno completo a mano aquí obligaría a tocar este archivo
 * cada vez que se añada una variable nueva, y la prueba se pudriría sola.
 */
function problemasEnLaClave(overrides: Record<string, string>): string[] {
  const resultado = EnvSchema.safeParse({ ...process.env, ...overrides });
  if (resultado.success) return [];
  return resultado.error.issues
    .filter((issue) => issue.path.join(".") === "STRIPE_SECRET_KEY")
    .map((issue) => issue.message);
}

describe("guarda 1: clave de prueba en producción", () => {
  it("la rechaza, porque la tienda parecería cobrar sin cobrar", () => {
    const problemas = problemasEnLaClave({
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: SK_PRUEBA,
      STRIPE_DEMO_MODE: "false",
    });

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("clave de PRUEBA");
  });

  it("la acepta si STRIPE_DEMO_MODE lo declara: es el caso de la demostración", () => {
    expect(
      problemasEnLaClave({
        NODE_ENV: "production",
        STRIPE_SECRET_KEY: SK_PRUEBA,
        STRIPE_DEMO_MODE: "true",
      }),
    ).toEqual([]);
  });
});

describe("guarda 2: clave real fuera de producción", () => {
  it("la rechaza, porque cada prueba con una tarjeta cobraría de verdad", () => {
    const problemas = problemasEnLaClave({
      NODE_ENV: "development",
      STRIPE_SECRET_KEY: SK_REAL,
      STRIPE_DEMO_MODE: "false",
    });

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("no es producción");
  });
});

describe("guarda 3: clave real con el modo demostración encendido", () => {
  it("la rechaza en producción: cobraría de verdad anunciando que no cobra", () => {
    const problemas = problemasEnLaClave({
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: SK_REAL,
      STRIPE_DEMO_MODE: "true",
    });

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("STRIPE_DEMO_MODE está encendido");
  });

  /**
   * Esta es la que fija la decisión de diseño: la guarda NO lleva condición de
   * NODE_ENV. Si alguien se la añade "para que sea coherente con las otras dos",
   * esta prueba se cae y explica por qué no debe llevarla.
   *
   * En desarrollo la guarda 2 también protesta, así que aquí salen DOS
   * problemas. Que salgan los dos es lo correcto: son dos cosas distintas mal.
   */
  it("la rechaza también fuera de producción, sin depender de NODE_ENV", () => {
    const problemas = problemasEnLaClave({
      NODE_ENV: "development",
      STRIPE_SECRET_KEY: SK_REAL,
      STRIPE_DEMO_MODE: "true",
    });

    expect(problemas).toHaveLength(2);
    expect(problemas.some((m) => m.includes("STRIPE_DEMO_MODE está encendido"))).toBe(
      true,
    );
  });

  it("deja pasar la clave real en producción cuando NO se anuncia demostración", () => {
    expect(
      problemasEnLaClave({
        NODE_ENV: "production",
        STRIPE_SECRET_KEY: SK_REAL,
        STRIPE_DEMO_MODE: "false",
      }),
    ).toEqual([]);
  });
});

describe("el despliegue real de LuCaLe", () => {
  it("acepta la combinación que tiene hoy en Render", () => {
    expect(
      problemasEnLaClave({
        NODE_ENV: "production",
        STRIPE_SECRET_KEY: SK_PRUEBA,
        STRIPE_DEMO_MODE: "true",
      }),
    ).toEqual([]);
  });

  it("habría rechazado la combinación que estuvo publicada por error", () => {
    expect(
      problemasEnLaClave({
        NODE_ENV: "production",
        STRIPE_SECRET_KEY: SK_REAL,
        STRIPE_DEMO_MODE: "true",
      }),
    ).not.toEqual([]);
  });
});
