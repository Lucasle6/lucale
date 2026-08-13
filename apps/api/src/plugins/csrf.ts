/**
 * Protección CSRF por doble envío (control de seguridad nº 9).
 *
 * QUÉ DETIENE. Un sitio ajeno monta un formulario que apunta a nuestra API. La
 * víctima lo visita con la sesión abierta, y el navegador adjunta sus cookies
 * obedientemente. El ataque no roba la cookie: usa la del propio usuario.
 *
 * CÓMO FUNCIONA EL DOBLE ENVÍO. El servidor deja un token en una cookie. El
 * cliente lo lee y lo repite en una cabecera. El servidor comprueba que
 * coincidan.
 *
 * Lo que lo hace funcionar es la política del mismo origen: el sitio del
 * atacante puede PROVOCAR que el navegador envíe nuestra cookie, pero no puede
 * LEERLA. Sin leerla no puede copiar el token en la cabecera, y sin la cabecera
 * la petición se rechaza.
 *
 * POR QUÉ ESTA COOKIE NO ES httpOnly, a diferencia de todas las demás. Parece
 * un descuido y es justo al revés: el frontend TIENE que poder leerla para
 * repetirla. Su seguridad no viene de ser secreta —viaja en cada respuesta—
 * sino de que solo nuestro propio origen puede leerla.
 *
 * POR QUÉ SE AÑADE SI YA ESTÁ SameSite. Las cookies de sesión son
 * `SameSite=Strict` y la del carrito `Lax`, lo que ya bloquea casi todo. Esto
 * es defensa en profundidad, y sobre todo un seguro contra el futuro: el día
 * que alguien ponga `SameSite=None` para arreglar otra cosa, la protección de
 * SameSite desaparecería en silencio. Esta falla ruidosamente.
 */

import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isProduction } from "../config/env.js";
import { ForbiddenError } from "../lib/errors.js";
import { generateToken } from "../lib/tokens.js";

/** `__Host-` en producción: impide que un subdominio comprometido la sobrescriba. */
export const CSRF_COOKIE = isProduction ? "__Host-csrf_token" : "csrf_token";
export const CSRF_HEADER = "x-csrf-token";

const CSRF_TTL_HORAS = 12;

/**
 * Métodos que no cambian nada. No necesitan token, y además son la ocasión de
 * entregarlo: el frontend hace un GET antes de cualquier mutación.
 */
const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Rutas exentas.
 *
 * El webhook de Stripe no puede llevar nuestro token —Stripe no lo conoce— y
 * no lo necesita: se autentica por FIRMA y no viaja con cookies de nadie, así
 * que no hay sesión que secuestrar. Exigirle CSRF sería romper los pagos a
 * cambio de nada.
 */
const RUTAS_EXENTAS = [/^\/v1\/webhooks\//];

/** Comparación en tiempo constante, para no filtrar el token carácter a carácter. */
function coincidenTokens(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  // timingSafeEqual exige la misma longitud, y comprobarla antes ya filtra un
  // bit de información. Es aceptable: la longitud del token es fija y pública.
  if (bufferA.length !== bufferB.length) return false;

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * El `async` sin `await` es OBLIGATORIO, no un descuido.
 *
 * Fastify exige que un hook de dos parámetros devuelva una promesa. Si devuelve
 * `undefined`, se queda esperando un callback `done` que nunca llega y la
 * petición se cuelga. Lo aprendimos el Día 5, y el fallo solo se manifiesta
 * cuando la guarda PASA — al lanzar sí funciona, así que pasa desapercibido.
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function comprobarCsrf(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (RUTAS_EXENTAS.some((patron) => patron.test(request.url))) return;

  const cookieActual = request.cookies[CSRF_COOKIE];

  if (METODOS_SEGUROS.has(request.method)) {
    // Se entrega un token si aún no tiene, para que el frontend pueda
    // repetirlo en la primera mutación que haga.
    if (cookieActual === undefined) {
      void reply.setCookie(CSRF_COOKIE, generateToken(), {
        // Legible por JavaScript A PROPÓSITO: ver la cabecera del archivo.
        httpOnly: false,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: CSRF_TTL_HORAS * 60 * 60,
      });
    }
    return;
  }

  // ── Mutación: hay que probar que el token se pudo LEER ───────────────────
  const enCabecera = request.headers[CSRF_HEADER];

  if (cookieActual === undefined || typeof enCabecera !== "string") {
    throw new ForbiddenError("Falta el token CSRF de esta petición");
  }

  if (!coincidenTokens(cookieActual, enCabecera)) {
    // Se registra: un token que no cuadra puede ser una pestaña vieja, o
    // puede ser alguien probando. Si son cincuenta desde la misma IP, ya no
    // hay duda, y eso solo se ve si queda escrito.
    request.log.warn(
      { ruta: `${request.method} ${request.url}`, ip: request.ip },
      "Token CSRF no coincide",
    );
    throw new ForbiddenError("El token CSRF no es válido");
  }
}

export function registerCsrf(app: FastifyInstance): void {
  app.addHook("onRequest", comprobarCsrf);
}
