/**
 * Cifrado simétrico para secretos que el servidor NECESITA poder leer.
 *
 * Un secreto TOTP no se puede hashear: el servidor tiene que recuperarlo cada
 * vez que valida un código de 6 dígitos, y un hash es irreversible. Así que se
 * cifra, con una clave que vive solo en el entorno (TOTP_ENCRYPTION_KEY).
 *
 * AES-256-GCM y no AES-CBC: GCM además de cifrar AUTENTICA. Si alguien altera
 * un solo byte del valor guardado en la base, el descifrado falla con un error
 * en vez de devolver basura silenciosamente.
 *
 * Formato guardado:  iv:authTag:ciphertext   (todo en hexadecimal)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
/** GCM recomienda 12 bytes de vector de inicialización. */
const IV_LENGTH = 12;

function key(): Buffer {
  return Buffer.from(env.TOTP_ENCRYPTION_KEY, "hex");
}

export function encryptSecret(plaintext: string): string {
  // IV nuevo en cada cifrado: reutilizarlo en GCM rompe la seguridad por
  // completo. Nunca es constante.
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");

  if (ivHex === undefined || tagHex === undefined || dataHex === undefined) {
    throw new Error("Secreto cifrado con formato inválido");
  }

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivHex, "hex"));
  // Si el dato fue manipulado, este authTag no cuadrará y final() lanzará.
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
