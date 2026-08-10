/**
 * Hashing de contraseñas con argon2id.
 *
 * Nunca guardamos la contraseña, solo su huella irreversible. Si roban la base
 * de datos, no se llevan contraseñas: se llevan hashes inservibles.
 *
 * Por qué argon2id y no SHA-256: un hash normal es RÁPIDO a propósito, y eso
 * lo vuelve inútil aquí — una GPU prueba miles de millones por segundo. Un hash
 * de contraseñas es LENTO a propósito. argon2id además exige mucha memoria por
 * cálculo (memory-hard), que es justo lo que las GPU no tienen: miles de
 * núcleos, poca memoria cada uno.
 *
 * Ver control de seguridad nº 1 en docs/03-seguridad.md.
 */

import { createHmac } from "node:crypto";
import argon2 from "argon2";
import { env } from "../config/env.js";

/** Parámetros recomendados por OWASP para argon2id. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB — lo que neutraliza el ataque con GPU
  timeCost: 2, // pasadas sobre la memoria
  parallelism: 1,
} as const;

/**
 * Mezcla la contraseña con el pepper.
 *
 * El salt (que argon2 genera solo) va guardado junto al hash en la base. El
 * pepper vive SOLO en el servidor. Consecuencia: si alguien roba únicamente la
 * base de datos —un backup filtrado, una inyección SQL— los hashes son
 * imposibles de atacar sin comprometer también el servidor. Dos cosas deben
 * fallar, no una.
 *
 * Se usa HMAC y no concatenación: `password + pepper` tiene debilidades
 * conocidas (extensión de longitud), HMAC es la construcción correcta.
 */
function applyPepper(password: string): Buffer {
  return createHmac("sha256", env.PASSWORD_PEPPER).update(password, "utf8").digest();
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(applyPepper(password), ARGON2_OPTIONS);
}

/**
 * Verifica una contraseña. Nunca lanza.
 *
 * Un hash corrupto en la base no debe tumbar el login con un 500: eso le diría
 * a un atacante que ese usuario existe. Se trata como "no coincide".
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, applyPepper(password));
  } catch {
    return false;
  }
}

/**
 * Indica si un hash se creó con parámetros más débiles que los actuales.
 *
 * El hardware mejora, así que los parámetros de OWASP suben con los años.
 * Cuando eso pase, subimos ARGON2_OPTIONS y rehasheamos la contraseña de cada
 * usuario la próxima vez que inicie sesión — es el único momento en que la
 * tenemos en claro. Migración silenciosa, sin pedirle nada a nadie.
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}

/**
 * Hash señuelo real, generado sobre 32 bytes aleatorios que nadie conoce ni
 * necesita conocer. Solo existe para que fakeVerify() tenga contra qué gastar
 * cómputo.
 *
 * Que esté público en el repositorio no importa: no protege nada. Lo único que
 * se le pide es ser un hash argon2id VÁLIDO, para que verify() haga el trabajo
 * completo en vez de fallar al parsearlo.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$2aqwl2ir/JrS6HUE0Whjew$ELMqF4VxXh/PwslchP0aXUMzt0RpoY2wzz0XF6V4dfQ";

/**
 * Quema el mismo tiempo que una verificación real, para cuando el email NO
 * existe.
 *
 * El ataque que detiene (timing attack, control nº 5): sin esto, el login
 * responde en ~100 ms si el usuario existe —porque calcula argon2— y en ~2 ms
 * si no existe, porque ni lo intenta. Esa diferencia es medible desde fuera:
 * un atacante descubre qué correos tienen cuenta cronometrando respuestas, sin
 * necesitar ninguna contraseña.
 *
 * Tu app puede tener el mejor hashing del mundo y aun así filtrar quiénes son
 * tus clientes solo por cuánto tarda en decir que no.
 */
export async function fakeVerify(): Promise<void> {
  try {
    await argon2.verify(DUMMY_HASH, applyPepper("contraseña-que-nadie-usa"));
  } catch {
    // El hash señuelo puede no ser verificable; da igual. Lo que importa es
    // haber gastado el tiempo de cómputo.
  }
}
