import "server-only";

import { cookies } from "next/headers";
import { API_URL, ApiRequestError } from "./api";
import type { ApiError } from "./api";

/**
 * Cliente de la API para Server Components.
 *
 * `import "server-only"` al principio no es decorativo: hace que la
 * compilación FALLE si alguien importa este archivo desde un Client Component.
 * Sin esa barrera, sería fácil arrastrar por accidente código de servidor —y
 * con él, cookies de sesión— al bundle que se envía al navegador.
 *
 * Aquí la cookie se reenvía a mano: Next la recibe del navegador, pero no la
 * propaga sola a otros servicios.
 */
export async function apiServer<T>(path: string, options: RequestInit = {}): Promise<T> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(cookieHeader === "" ? {} : { cookie: cookieHeader }),
      ...options.headers,
    },
    // El panel muestra stock y estados que cambian a cada momento: nunca se
    // sirve desde caché.
    cache: "no-store",
  });

  const texto = await response.text();
  const cuerpo: unknown = texto === "" ? null : JSON.parse(texto);

  if (!response.ok) {
    const error =
      typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo
        ? (cuerpo.error as ApiError)
        : { code: "UNKNOWN", message: "Error inesperado" };
    throw new ApiRequestError(response.status, error);
  }

  return cuerpo as T;
}

/** Indica si hay sesión de admin válida. Se usa para redirigir al login. */
export async function haySesionDeAdmin(): Promise<boolean> {
  try {
    await apiServer("/admin/auth/me");
    return true;
  } catch {
    return false;
  }
}
