"use client";

/**
 * Token CSRF en el navegador.
 *
 * La cookie NO es httpOnly a propósito —es la única del sistema que no lo es—
 * porque el cliente tiene que poder leerla para repetirla en la cabecera. Su
 * seguridad no viene de ser secreta, sino de que solo nuestro propio origen
 * puede leerla: el sitio de un atacante puede provocar que el navegador la
 * envíe, pero no verla.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

/** El prefijo __Host- solo se puede usar sobre HTTPS, así que cambia por entorno. */
const NOMBRES = ["__Host-csrf_token", "csrf_token"];

function leerCookie(): string | null {
  for (const nombre of NOMBRES) {
    const encontrada = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${nombre}=`));
    if (encontrada !== undefined)
      return decodeURIComponent(encontrada.slice(nombre.length + 1));
  }
  return null;
}

/**
 * Devuelve el token, pidiéndolo al servidor si el navegador aún no lo tiene.
 *
 * Ese caso es lo normal, no la excepción: la tienda lee el catálogo desde el
 * servidor, así que esas respuestas nunca pasan por el navegador y la cookie no
 * llega sola.
 */
export async function obtenerTokenCsrf(): Promise<string | null> {
  const existente = leerCookie();
  if (existente !== null) return existente;

  await fetch(`${API_URL}/csrf`, { credentials: "include" });
  return leerCookie();
}

/** Añade la cabecera a unas cabeceras existentes, si hay token. */
export async function conCsrf(
  base: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await obtenerTokenCsrf();
  return token === null ? base : { ...base, "x-csrf-token": token };
}
