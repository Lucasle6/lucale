/**
 * Contratos del módulo de autenticación.
 */

import { z } from "zod";

/**
 * Las 40 contraseñas más usadas del mundo, más algunas variantes en español y
 * relacionadas con este proyecto. En producción esto se sustituye por una
 * comprobación contra Have I Been Pwned (k-anonymity), que cubre millones.
 *
 * El ataque real no consiste en probar combinaciones al azar: consiste en
 * probar las que ya se sabe que la gente usa.
 */
const COMMON_PASSWORDS = new Set([
  "123456789012",
  "contrasena123",
  "contraseña123",
  "password1234",
  "qwertyuiop12",
  "administrador",
  "bodegondejose",
  "bodegon12345",
  "iloveyou1234",
  "123456123456",
  "abcd12345678",
  "passwordpassword",
  "qwerty123456",
  "111111111111",
  "letmein12345",
  "welcome12345",
  "monkey123456",
  "dragon123456",
]);

function esContrasenaComun(value: string): boolean {
  return COMMON_PASSWORDS.has(value.toLowerCase().replace(/\s+/g, ""));
}

/**
 * Política de contraseñas siguiendo NIST 800-63B.
 *
 * Nota lo que NO exigimos: mayúsculas, números ni símbolos. Es deliberado y va
 * contra lo que hace casi todo el mundo.
 *
 * Las reglas de complejidad producen contraseñas PEORES. Obligado a poner
 * mayúscula, número y símbolo, el humano escribe "Password1!", que cumple todo
 * y está en cualquier diccionario de ataque. Sin esas reglas escribe "mi perro
 * se llama canela": más larga, más fácil de recordar y astronómicamente más
 * cara de romper.
 *
 * La longitud vence a la complejidad. Lo que sí importa es un mínimo generoso
 * y descartar las contraseñas ya filtradas.
 */
export const passwordSchema = z
  .string()
  .min(12, "debe tener al menos 12 caracteres")
  // El tope evita que alguien mande 10 MB y nos haga gastar CPU en argon2.
  .max(128, "no puede pasar de 128 caracteres")
  .refine((value) => !esContrasenaComun(value), {
    message: "esta contraseña aparece en listas de contraseñas filtradas, elige otra",
  });

export const emailSchema = z
  .email("no parece un correo válido")
  .max(254) // límite del estándar RFC 5321
  .transform((value) => value.trim().toLowerCase());

// ─── Entradas ────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Al iniciar sesión NO se aplica la política: si un usuario tiene una
  // contraseña antigua de 8 caracteres, debe poder entrar para cambiarla.
  // Validar la política aquí lo dejaría fuera de su propia cuenta.
  password: z.string().min(1).max(128),
  // Código TOTP, si la cuenta tiene 2FA activo (bloque E).
  totpCode: z
    .string()
    .regex(/^\d{6}$/, "el código son 6 dígitos")
    .optional(),
  backupCode: z.string().max(20).optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

// ─── Salidas ─────────────────────────────────────────────────────────────────

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(["CUSTOMER", "ADMIN", "SUPER_ADMIN"]),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  createdAt: z.string(),
});

/**
 * Respuesta genérica para operaciones que NO deben revelar si una cuenta
 * existe: registro, solicitud de reseteo. Siempre la misma, exista o no.
 */
export const genericAcceptedSchema = z.object({
  message: z.string(),
});

export const loginResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("authenticated"),
    user: userProfileSchema,
  }),
  z.object({
    status: z.literal("two_factor_required"),
    // Token efímero que prueba que la contraseña ya fue correcta. Sin él,
    // cualquiera podría saltarse el primer factor enviando solo un código.
    challengeToken: z.string(),
  }),
]);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
