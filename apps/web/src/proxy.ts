import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Content Security Policy con nonce por petición (control de seguridad nº 14).
 *
 * QUÉ DETIENE. Es la ÚLTIMA línea de defensa, la que actúa cuando todo lo demás
 * ya falló. Si un XSS se cuela —por un escape olvidado, por una dependencia
 * comprometida—, la CSP impide que el script inyectado llegue a ejecutarse.
 *
 * POR QUÉ CON NONCE Y NO CON UNA LISTA DE DOMINIOS. Una allowlist de orígenes
 * se rompe en cuanto uno de esos dominios sirva algo manipulable. El nonce es
 * un valor aleatorio distinto en CADA petición: el navegador solo ejecuta los
 * scripts que lo lleven, y un atacante que inyecta HTML no puede adivinarlo.
 *
 * `strict-dynamic` completa la idea: un script ya autorizado por su nonce puede
 * cargar otros, que heredan la confianza. Es lo que permite que el runtime de
 * Next siga funcionando sin abrir la política a medio internet.
 *
 * En Next 16 esto vive en `proxy.ts`. En versiones anteriores el archivo se
 * llamaba `middleware.ts`.
 */

/** Origen de la API, que corre en otro puerto (y en producción, en otro dominio). */
function origenDeLaApi(): string {
  const url = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";
  try {
    return new URL(url).origin;
  } catch {
    return "http://localhost:4000";
  }
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const enDesarrollo = process.env.NODE_ENV === "development";
  const api = origenDeLaApi();

  /**
   * Los estilos SÍ permiten 'unsafe-inline', y es una decisión, no un descuido.
   *
   * Se intentó primero con nonce estricto. Una comprobación visual pareció
   * bastar —la página se veía bien porque Tailwind sirve un CSS externo—, pero
   * las pruebas E2E destaparon una docena de violaciones por carga: Next y
   * React inyectan estilos en línea propios que no llevan el nonce.
   *
   * Mantener una política que registra doce violaciones en cada visita es peor
   * que aflojarla: acostumbra a ignorar los informes de CSP, y el día que
   * aparezca una violación de verdad, nadie la va a mirar.
   *
   * El riesgo que se acepta es acotado. Una inyección de CSS puede desfigurar
   * la página o, rebuscando mucho, filtrar datos con selectores de atributo.
   * Una inyección de SCRIPT se lleva la sesión entera — y ahí seguimos con
   * nonce y sin unsafe-inline, que es donde importa.
   */
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${enDesarrollo ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: ${api};
    font-src 'self';
    connect-src 'self' ${api}${enDesarrollo ? " ws: wss:" : ""};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const cabecerasDeEntrada = new Headers(request.headers);
  // Next lee este encabezado para poner el nonce en los scripts que él inyecta.
  cabecerasDeEntrada.set("x-nonce", nonce);
  cabecerasDeEntrada.set("Content-Security-Policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabecerasDeEntrada } });
  respuesta.headers.set("Content-Security-Policy", csp);

  return respuesta;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
