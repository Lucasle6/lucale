/**
 * Segundo factor con TOTP (Time-based One-Time Password, RFC 6238).
 *
 * Cómo funciona: el servidor y el teléfono comparten un secreto UNA sola vez
 * (al escanear el QR). A partir de ahí, cada 30 segundos ambos calculan
 * HMAC(secreto, tiempo) y se quedan con 6 dígitos. Coinciden porque tienen el
 * mismo secreto y el mismo reloj — sin hablar entre sí. Por eso funciona en
 * modo avión.
 *
 * Control de seguridad nº 4 de docs/03-seguridad.md.
 */

import { generate, generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { env } from "../config/env.js";

/**
 * Tolerancia de reloj, en segundos.
 *
 * Los relojes nunca están perfectamente sincronizados y la persona tarda en
 * teclear, así que aceptamos también el código del periodo anterior y el
 * siguiente. Ampliarla más sería cómodo, pero le daría al atacante más margen
 * para usar un código interceptado.
 */
const EPOCH_TOLERANCE_SECONDS = 30;

export interface TotpVerification {
  valid: boolean;
  /**
   * Periodo de 30 s al que pertenece el código aceptado. Se guarda para
   * rechazar reutilizaciones (ver `afterTimeStep` más abajo).
   */
  timeStep: number | null;
}

/** Genera un secreto nuevo en base32, el formato que leen las apps. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * URI `otpauth://` que se convierte en código QR.
 *
 * El `label` es lo que el usuario verá en su app junto al código, para saber
 * de qué cuenta es cuando tenga varias.
 */
export function buildOtpAuthUrl(email: string, secret: string): string {
  return generateURI({ issuer: env.TOTP_ISSUER, label: email, secret });
}

/** Convierte la URI en una imagen QR embebible (data URI PNG). */
export function buildQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
}

/**
 * Comprueba un código de 6 dígitos.
 *
 * `afterTimeStep` es protección contra reuso incorporada en la librería:
 * rechaza cualquier código cuyo periodo sea igual o anterior al último ya
 * consumido. El ataque que cierra: si alguien te ve la pantalla o intercepta
 * el número, tiene 30 s para usarlo — con esto, el código muere en el instante
 * en que lo usas tú.
 */
export async function verifyTotp(
  code: string,
  secret: string,
  afterTimeStep: number | null,
): Promise<TotpVerification> {
  try {
    const result = await verify({
      secret,
      token: code,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
      ...(afterTimeStep === null ? {} : { afterTimeStep }),
    });

    return {
      valid: result.valid,
      timeStep: "timeStep" in result ? (result.timeStep ?? null) : null,
    };
  } catch {
    // Un secreto corrupto se trata como "no coincide", nunca como un 500.
    return { valid: false, timeStep: null };
  }
}

/**
 * Genera un código. Solo se usa en tests.
 *
 * `offsetSeconds` permite pedir el código de otro periodo, para simular el
 * paso del tiempo sin esperar 30 segundos de verdad.
 */
export async function generateTotpCode(
  secret: string,
  offsetSeconds = 0,
): Promise<string> {
  return generate({
    secret,
    epoch: Math.floor(Date.now() / 1000) + offsetSeconds,
  });
}
