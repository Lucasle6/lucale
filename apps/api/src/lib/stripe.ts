/**
 * Cliente de Stripe.
 *
 * Se crea UNA vez y se comparte: por dentro mantiene un pool de conexiones
 * HTTPS reutilizables. Crear un cliente por petición tiraría ese pool a la
 * basura y añadiría un handshake TLS completo a cada cobro.
 */

import Stripe from "stripe";
import { env } from "../config/env.js";

/**
 * Versión de la API de Stripe que hablamos, fijada a propósito.
 *
 * Stripe evoluciona su API y le pone fecha a cada versión. Cada petición lleva
 * esta cadena, así que Stripe nos responde en el dialecto que este código
 * entiende, aunque haya sacado tres versiones nuevas desde entonces.
 *
 * Sin fijarla, un cambio del lado de Stripe podría alterar la forma de sus
 * respuestas sin que nosotros toquemos una línea — y romper los cobros un
 * martes cualquiera. Actualizarla es una decisión deliberada: se sube la fecha,
 * se leen las notas de migración y se corren los tests.
 */
const API_VERSION = "2026-07-29.dahlia";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: API_VERSION,

  /**
   * Reintentos automáticos ante fallos de red.
   *
   * Aquí hay una trampa que conviene ver: reintentar una petición que ya llegó
   * es exactamente cómo se cobra dos veces. Si mandamos "crea el cobro", se
   * ejecuta, y la respuesta se pierde en el camino, el reintento crearía un
   * segundo cobro.
   *
   * Stripe lo resuelve con CLAVES DE IDEMPOTENCIA: el SDK genera una por
   * petición y la repite en los reintentos. Stripe reconoce que es la misma
   * operación y devuelve el resultado de la primera en vez de ejecutarla otra
   * vez. Por eso reintentar aquí es seguro — y por eso nosotros pasamos además
   * nuestra propia clave al crear la sesión (ver checkout.service.ts).
   */
  maxNetworkRetries: 2,

  /** Si Stripe no contesta en 20 s, preferimos fallar a dejar colgado al cliente. */
  timeout: 20_000,

  /** Aparece en los registros del dashboard: ayuda a saber qué pidió qué. */
  appInfo: {
    name: "LuCaLe",
    version: "0.1.0",
  },
});

/** Reexportamos el tipo para no repetir el import en cada módulo. */
export type { Stripe };
