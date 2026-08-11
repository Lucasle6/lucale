/**
 * Tokens de acceso (JWT) y cookies de sesión.
 *
 * Diseño de dos tokens:
 *
 *   ACCESS   JWT firmado, 15 min, NO se guarda en la base. Lleva dentro quién
 *            eres; el servidor verifica la firma y confía sin consultar
 *            Postgres. Rapidísimo, pero imposible de revocar — de ahí que dure
 *            tan poco.
 *
 *   REFRESH  Opaco, 30 días, SÍ se guarda (hasheado). Solo sirve para pedir
 *            tokens de acceso nuevos, y se puede matar al instante.
 *
 * El equilibrio: velocidad en el 99 % de las peticiones y control real donde
 * importa. Si roban un access token, el atacante tiene 15 minutos; si roban el
 * refresh, lo detectamos y revocamos la familia entera (ver auth.service.ts).
 */

import type { UserRole } from "@bodegon/db";
import type { CookieSerializeOptions } from "@fastify/cookie";
import { SignJWT, jwtVerify } from "jose";
import { env, isProduction } from "../config/env.js";

/**
 * Audiencia del token: para qué mundo sirve.
 *
 * Es la capa criptográfica del requisito de admin aislado. Un token de cliente
 * presentado en un endpoint de admin falla al VERIFICARSE, antes de llegar a
 * ninguna lógica de permisos. No es un `if` que alguien pueda olvidar.
 */
export const TOKEN_AUDIENCE = {
  customer: "customer",
  admin: "admin",
} as const;

export type TokenAudience = (typeof TOKEN_AUDIENCE)[keyof typeof TOKEN_AUDIENCE];

export interface AccessTokenPayload {
  /** `sub` (subject) es el estándar JWT para "de quién es este token". */
  sub: string;
  role: UserRole;
  aud: TokenAudience;
}

/** Nombres de las cookies. El prefijo __Host- solo es válido bajo HTTPS. */
export const COOKIE_NAMES = {
  accessToken: isProduction ? "__Host-access_token" : "access_token",
  refreshToken: isProduction ? "__Host-refresh_token" : "refresh_token",
} as const;

/**
 * Opciones base de las cookies de sesión.
 *
 *   httpOnly          JavaScript no puede leerla → un XSS no roba el token
 *   secure            solo viaja por HTTPS → sin intermediarios
 *   sameSite strict   no se envía desde otros sitios → sin CSRF
 *
 * El prefijo __Host- de arriba añade una garantía del navegador: rechaza la
 * cookie si no cumple Secure + Path=/ + sin Domain, lo que impide que un
 * subdominio comprometido la sobrescriba.
 */
function baseCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    // __Host- exige Path=/ obligatoriamente. Fuera de producción acotamos la
    // cookie de refresco a las rutas de auth, que es lo único que la necesita.
    path: "/",
    signed: true,
  };
}

export function accessCookieOptions(): CookieSerializeOptions {
  return {
    ...baseCookieOptions(),
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  };
}

export function refreshCookieOptions(): CookieSerializeOptions {
  return {
    ...baseCookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  };
}

/** Opciones para borrar una cookie: mismas banderas, sin maxAge. */
export function clearCookieOptions(): CookieSerializeOptions {
  return baseCookieOptions();
}

// ─── Firma y verificación ────────────────────────────────────────────────────

const ALGORITHM = "HS256";
const ISSUER = "bodegon-api";

function accessKey(): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}

export async function signAccessToken(payload: {
  sub: string;
  role: UserRole;
  aud: TokenAudience;
}): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setAudience(payload.aud)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${String(env.ACCESS_TOKEN_TTL_MINUTES)}m`)
    .sign(accessKey());
}

/**
 * Verifica un access token exigiendo la audiencia esperada.
 *
 * Ese `audience` es la clave del aislamiento del admin: un token de cliente
 * presentado en una ruta de admin falla AQUÍ, en la verificación
 * criptográfica, antes de llegar a ninguna comprobación de permisos.
 */
export async function verifyAccessToken(
  token: string,
  audience: TokenAudience,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessKey(), {
    algorithms: [ALGORITHM], // fijo: impide el ataque de confusión de algoritmo
    issuer: ISSUER,
    audience,
  });

  if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new Error("Token con contenido inesperado");
  }

  return {
    sub: payload.sub,
    role: payload.role as UserRole,
    aud: audience,
  };
}

/**
 * Token efímero que prueba "esta persona ya acertó la contraseña".
 *
 * Sin él, el endpoint de 2FA aceptaría un código de 6 dígitos suelto y
 * cualquiera podría saltarse el primer factor: bastaría adivinar un número de
 * un millón contra una cuenta cuya contraseña no conoce. Con él, hay que
 * superar los dos factores en orden.
 *
 * Dura 5 minutos y usa un secreto distinto (el de refresco), para que no sirva
 * como token de acceso ni al revés.
 */
const CHALLENGE_AUDIENCE = "two-factor-challenge";

export async function signTwoFactorChallenge(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setAudience(CHALLENGE_AUDIENCE)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(env.JWT_REFRESH_SECRET));
}

export async function verifyTwoFactorChallenge(token: string): Promise<string> {
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(env.JWT_REFRESH_SECRET),
    { algorithms: [ALGORITHM], issuer: ISSUER, audience: CHALLENGE_AUDIENCE },
  );

  if (typeof payload.sub !== "string") {
    throw new Error("Challenge con contenido inesperado");
  }
  return payload.sub;
}
