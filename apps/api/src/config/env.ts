/**
 * Validación del entorno con Zod.
 *
 * La idea: `process.env` es un objeto de strings que puede contener cualquier cosa,
 * o nada. Sin validar, un `DATABASE_URL` mal escrito no falla al arrancar — falla en
 * la primera consulta, en producción, a las 3 de la mañana. Y un `PORT` ausente se
 * convierte silenciosamente en `undefined`.
 *
 * Aquí lo validamos **una sola vez, al arrancar**. Si algo falta o está mal, el
 * proceso muere de inmediato con un mensaje que dice exactamente qué arreglar.
 * Eso es *fail fast*: prefieres un fallo ruidoso hoy a uno silencioso mañana.
 *
 * A partir de este archivo, el resto de la aplicación importa `env` y trabaja con
 * un objeto **tipado y garantizado**. Nadie vuelve a tocar `process.env`.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// El .env vive en la raíz del monorepo, no dentro de apps/api: una sola fuente de
// verdad para todos los paquetes. Lo resolvemos desde la ubicación de este archivo
// y no desde process.cwd(), que cambia según desde dónde lances el comando.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../..");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

/** Prefijo de los secretos de ejemplo. Sirve para bloquearlos en producción. */
const DEV_SECRET_PREFIX = "dev_only_";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Por defecto 127.0.0.1 y no 0.0.0.0: en desarrollo no queremos exponer la API
    // a toda la red local sin decirlo explícitamente.
    HOST: z.string().min(1).default("127.0.0.1"),

    // Todo lo que viene del entorno es string. `coerce` lo convierte a number antes
    // de validar el rango — si alguien escribe PORT=abc, falla aquí y no al escuchar.
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    // Silencia los logs en los tests: su salida debe ser el resultado de las
    // pruebas, no el tráfico HTTP simulado.
    VITEST: z.string().optional(),

    DATABASE_URL: z
      .string()
      .min(1)
      .refine((value) => value.startsWith("postgresql://"), {
        message: "debe ser una cadena de conexión de PostgreSQL (postgresql://...)",
      }),

    // 32 caracteres es el mínimo razonable para HMAC-SHA256. Genera los reales con:
    //   openssl rand -base64 48
    JWT_ACCESS_SECRET: z.string().min(32, "mínimo 32 caracteres"),
    JWT_REFRESH_SECRET: z.string().min(32, "mínimo 32 caracteres"),

    // Pepper: secreto que se mezcla con la contraseña ANTES de hashearla y que
    // vive solo en el servidor, nunca en la base de datos. Si roban solo la
    // base, los hashes son inatacables sin esto.
    PASSWORD_PEPPER: z.string().min(32, "mínimo 32 caracteres"),

    // Firma las cookies, para detectar si alguien las manipula.
    COOKIE_SECRET: z.string().min(32, "mínimo 32 caracteres"),

    // Clave AES-256 para cifrar los secretos TOTP en reposo. Exactamente 64
    // caracteres hexadecimales = 32 bytes. Genera una con:
    //   openssl rand -hex 32
    TOTP_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-f]{64}$/i, "deben ser 64 caracteres hexadecimales (32 bytes)"),

    // Vida de los tokens. El de acceso es corto a propósito: limita la ventana
    // de daño si uno se filtra.
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    // Nombre que aparece en la app de autenticación del usuario (Google
    // Authenticator, 1Password...) junto al código de 6 dígitos.
    TOTP_ISSUER: z.string().min(1).default("Bodegón de José"),

    // Orígenes permitidos por CORS. Se configuran en el Día 3, pero se validan desde
    // hoy: una allowlist explícita es más segura que un `origin: true` que acepta todo.
    WEB_ORIGIN: z.url(),
    ADMIN_ORIGIN: z.url(),
  })
  .superRefine((env, ctx) => {
    // Cada secreto protege una cosa distinta y todos deben ser distintos entre
    // sí. Si el de acceso y el de refresco coincidieran, un access token robado
    // valdría como refresh token y la rotación dejaría de servir de nada.
    const secretKeys = [
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "PASSWORD_PEPPER",
      "COOKIE_SECRET",
    ] as const;

    const seen = new Map<string, string>();
    for (const key of secretKeys) {
      const previous = seen.get(env[key]);
      if (previous !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `debe ser distinto de ${previous}: cada secreto protege una cosa diferente`,
        });
      } else {
        seen.set(env[key], key);
      }
    }

    // Red de seguridad: los secretos de ejemplo del .env.example están en el
    // repositorio, así que son públicos. Que nunca lleguen a producción.
    if (env.NODE_ENV === "production") {
      for (const key of secretKeys) {
        if (env[key].startsWith(DEV_SECRET_PREFIX)) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message:
              "es un secreto de ejemplo y está en el repositorio: genera uno real con `openssl rand -base64 48`",
          });
        }
      }
      if (env.TOTP_ENCRYPTION_KEY.startsWith("0000")) {
        ctx.addIssue({
          code: "custom",
          path: ["TOTP_ENCRYPTION_KEY"],
          message: "es la clave de ejemplo: genera una real con `openssl rand -hex 32`",
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  const problems = result.error.issues.map((issue) => {
    const variable = issue.path.map(String).join(".") || "(raíz)";
    // El mensaje por defecto de Zod para una variable ausente es
    // "expected string, received undefined": correcto, pero es jerga. Si la
    // variable no está definida, lo decimos en términos de lo que hay que hacer.
    const message =
      process.env[variable] === undefined ? "no está definida en el .env" : issue.message;
    return `  · ${variable}: ${message}`;
  });

  process.stderr.write(
    [
      "",
      "✖  No se pudo arrancar: hay variables de entorno inválidas o ausentes.",
      "",
      ...problems,
      "",
      "   Copia la plantilla y ajústala:  cp .env.example .env",
      "",
      "",
    ].join("\n"),
  );

  // Código 1: el proceso murió por un error. Docker, CI y systemd lo interpretan
  // como fallo y no dan el arranque por bueno.
  process.exit(1);
}

/** Entorno validado y tipado. Única puerta de acceso a la configuración. */
export const env: Env = result.data;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
