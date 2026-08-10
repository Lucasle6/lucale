/**
 * Tokens opacos: refresh de sesión, verificación de email, reseteo de
 * contraseña y códigos de respaldo.
 *
 * "Opaco" significa que el token no contiene información —a diferencia de un
 * JWT— sino que es puro azar. Solo sirve para buscar la fila correspondiente en
 * la base de datos, y por eso se puede revocar al instante: se borra la fila.
 *
 * Se guardan HASHEADOS, igual que las contraseñas: si roban la base, no se
 * llevan sesiones activas.
 *
 * Por qué SHA-256 y no argon2 aquí: argon2 es lento a propósito para frenar a
 * quien adivina contraseñas humanas. Un token de 256 bits aleatorios no se
 * puede adivinar —no hay diccionario ni patrones—, así que la lentitud no
 * compraría seguridad y sí costaría 20 ms en cada refresco de sesión. Herramienta
 * correcta para cada trabajo, no "la más fuerte siempre".
 */

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/** 32 bytes = 256 bits de entropía. Imposible de adivinar por fuerza bruta. */
const TOKEN_BYTES = 32;

/** Genera un token nuevo en base64url (seguro para URLs y cookies). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Huella del token para guardar en la base.
 *
 * Con HMAC y no SHA-256 a secas: sin la clave, alguien con la base robada
 * podría precalcular hashes. La clave lo impide.
 */
export function hashToken(token: string): string {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(token, "utf8").digest("hex");
}

/**
 * Compara dos huellas en tiempo constante.
 *
 * Una comparación normal (===) se detiene en el primer carácter distinto, así
 * que tarda más cuanto más acierta el atacante. Cronometrando, podría ir
 * adivinando el token carácter a carácter. timingSafeEqual siempre tarda lo
 * mismo.
 */
export function compareTokenHash(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  // timingSafeEqual exige la misma longitud; distinta longitud ya es "no
  // coincide" sin filtrar nada útil.
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Fecha de caducidad a N días desde ahora. */
export function expiresInDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Fecha de caducidad a N minutos desde ahora. */
export function expiresInMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Código de respaldo de 2FA: 10 dígitos en dos grupos, fácil de leer en voz
 * alta y de teclear cuando perdiste el teléfono y estás nervioso.
 *
 * randomInt del módulo crypto, no Math.random(): este último es predecible y
 * jamás debe usarse para nada de seguridad.
 */
export function generateBackupCode(): string {
  const digits = Array.from({ length: 10 }, () => randomInt(0, 10)).join("");
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Normaliza un código tecleado por el usuario: quita guiones y espacios. */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "");
}
