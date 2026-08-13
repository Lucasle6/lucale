#!/usr/bin/env node
/**
 * Genera los secretos de producción.
 *
 *   pnpm secretos
 *
 * POR QUÉ EXISTE ESTO. Es el momento del despliegue en el que más se improvisa:
 * hace falta media docena de valores aleatorios distintos, y la tentación de
 * reutilizar uno "porque total" es enorme. Cada uno protege una cosa diferente,
 * y la validación de entorno los rechaza si coinciden — pero mejor no llegar a
 * esa comprobación.
 *
 * NO ESCRIBE NINGÚN ARCHIVO, a propósito. Imprime en pantalla para que los
 * copies al panel de tu proveedor. Un archivo con secretos de producción en tu
 * disco es un archivo que acaba en un backup, en un repositorio o en un chat.
 */

import { randomBytes } from "node:crypto";

/** 48 bytes en base64 ≈ 64 caracteres. El mínimo que exige el esquema es 32. */
const secreto = () => randomBytes(48).toString("base64");

/** Clave AES-256: exactamente 32 bytes = 64 caracteres hexadecimales. */
const claveAes = () => randomBytes(32).toString("hex");

const valores = {
  JWT_ACCESS_SECRET: secreto(),
  JWT_REFRESH_SECRET: secreto(),
  PASSWORD_PEPPER: secreto(),
  COOKIE_SECRET: secreto(),
  TOTP_ENCRYPTION_KEY: claveAes(),
};

const notas = {
  JWT_ACCESS_SECRET: "firma los tokens de acceso (15 min de vida)",
  JWT_REFRESH_SECRET: "firma los tokens de refresco (30 días)",
  PASSWORD_PEPPER: "se mezcla con las contraseñas ANTES de hashearlas",
  COOKIE_SECRET: "firma las cookies para detectar manipulación",
  TOTP_ENCRYPTION_KEY: "cifra los secretos de 2FA en reposo",
};

const lineas = [
  "",
  "  Secretos de producción — cópialos al panel de tu proveedor.",
  "",
  "  ⚠  NO los guardes en ningún archivo de este repositorio.",
  "  ⚠  Si rotas PASSWORD_PEPPER, TODAS las contraseñas dejan de validar.",
  "  ⚠  Si rotas TOTP_ENCRYPTION_KEY, todos los 2FA dejan de funcionar.",
  "",
];

for (const [clave, valor] of Object.entries(valores)) {
  lineas.push(`  # ${notas[clave]}`);
  lineas.push(`  ${clave}=${valor}`);
  lineas.push("");
}

lineas.push("  # Y estos NO se generan: te los da cada proveedor.");
lineas.push("  DATABASE_URL=          # Neon");
lineas.push("  STRIPE_SECRET_KEY=     # panel de Stripe, modo REAL (sk_live_)");
lineas.push("  STRIPE_WEBHOOK_SECRET= # al registrar el endpoint en Stripe (whsec_)");
lineas.push("  WEB_ORIGIN=            # https://tu-dominio");
lineas.push("  ADMIN_ORIGIN=          # https://admin.tu-dominio");
lineas.push("  NODE_ENV=production");
lineas.push("");

process.stdout.write(lineas.join("\n"));
