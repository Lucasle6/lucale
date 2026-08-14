/**
 * Cliente de la API para el panel.
 *
 * Dos variantes, porque el panel llama a la API desde dos sitios distintos:
 *
 *   SERVIDOR (Server Components)  Next recibe la cookie del navegador pero NO
 *                                 la reenvía sola: hay que leerla y ponerla en
 *                                 la petición a mano.
 *
 *   NAVEGADOR (Client Components) El navegador adjunta la cookie por su cuenta
 *                                 con credentials: "include".
 *
 * Las cookies se comparten entre localhost:3001 y localhost:4000 porque los
 * navegadores no aíslan cookies por puerto, solo por host.
 */

import { conCsrf } from "./csrf";

/**
 * Para el NAVEGADOR: ruta relativa, reenviada por Next (ver next.config.ts).
 *
 * Así las cookies de sesión son de primera parte. Apuntando al dominio de la
 * API, el navegador las descartaría por ser de terceros y el panel no podría
 * mantener la sesión abierta.
 */
export const API_URL = "/v1";

/**
 * Base de las imágenes subidas, que SÍ van directas a la API.
 *
 * No llevan cookies ni credenciales, así que no tienen el problema de arriba y
 * no hay razón para hacerlas pasar por el reenvío.
 */
export const FILES_URL = process.env.NEXT_PUBLIC_FILES_URL ?? "http://localhost:4000";

/**
 * Dónde vive la TIENDA pública. La usa el enlace "ver en la tienda".
 *
 * Estuvo escrita a mano dentro de la vista como `http://localhost:3000`, así
 * que en producción ese enlace llevaba al ordenador de quien lo pulsara. No
 * fallaba de forma visible: simplemente no cargaba, y se achacaba al navegador.
 */
export const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(error.message);
    this.name = "ApiRequestError";
  }
}

async function parsear<T>(response: Response): Promise<T> {
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

// ─── Desde el navegador ──────────────────────────────────────────────────────

/**
 * Llamada desde un Client Component.
 *
 * `credentials: "include"` es lo que hace que la cookie httpOnly viaje. Sin
 * eso, el navegador no la adjunta en peticiones a otro origen y la API
 * respondería 401 aunque la sesión esté abierta.
 */
export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    // El token CSRF va en cabecera además de en cookie (control nº 9). El
    // panel lo necesita igual que la tienda: es donde se cambian precios y se
    // aprueban reembolsos, o sea el objetivo que más interesa secuestrar.
    headers: await conCsrf({
      ...(necesitaContentTypeJson(options) ? { "content-type": "application/json" } : {}),
      ...(options.headers as Record<string, string> | undefined),
    }),
  });

  return parsear<T>(response);
}

/**
 * ¿Hay que anunciar que el cuerpo es JSON?
 *
 * Solo si hay cuerpo, y solo si no lo pone el navegador por su cuenta.
 *
 * EL FALLO QUE ESTO ARREGLA. Antes se ponía la cabecera en TODA petición que no
 * fuera FormData, incluidas las que no llevan cuerpo. Fastify lo interpreta al
 * pie de la letra: "viene JSON" seguido de nada es una petición mal formada, y
 * la rechaza con FST_ERR_CTP_EMPTY_JSON_BODY antes de llegar a la ruta.
 *
 * Rompía en silencio las dos únicas mutaciones sin cuerpo del panel: borrar una
 * imagen y CERRAR SESIÓN. Nadie lo vio porque el cliente mostraba un mensaje
 * genérico y el error real no salía de la consola del navegador.
 *
 * `FormData` se excluye aparte porque ahí la cabecera la pone el navegador, con
 * el `boundary` que separa las partes. Escribirla a mano deja el envío sin ese
 * boundary y el servidor no puede trocear el archivo.
 */
function necesitaContentTypeJson(options: RequestInit): boolean {
  if (options.body === undefined || options.body === null) return false;
  return !(options.body instanceof FormData);
}
