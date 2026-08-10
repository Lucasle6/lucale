/**
 * Tests de las primitivas criptográficas.
 *
 * No prueban "que funcione" en el sentido feliz, sino las propiedades de
 * seguridad concretas: que el señuelo tarde lo mismo que una verificación real,
 * que un secreto manipulado se detecte, que un hash corrupto no tumbe el login.
 */

import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { fakeVerify, hashPassword, needsRehash, verifyPassword } from "./password.js";
import {
  compareTokenHash,
  generateBackupCode,
  generateToken,
  hashToken,
  normalizeBackupCode,
} from "./tokens.js";

async function medirMs(fn: () => Promise<unknown>): Promise<number> {
  const inicio = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - inicio) / 1e6;
}

describe("hashing de contraseñas", () => {
  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await hashPassword("MiClaveSegura123");

    await expect(verifyPassword(hash, "MiClaveSegura123")).resolves.toBe(true);
    await expect(verifyPassword(hash, "MiClaveSegura124")).resolves.toBe(false);
  });

  it("produce hashes distintos para la misma contraseña", async () => {
    // El salt aleatorio impide saber que dos usuarios comparten contraseña.
    const [a, b] = await Promise.all([hashPassword("misma"), hashPassword("misma")]);
    expect(a).not.toBe(b);
  });

  it("usa argon2id con los parámetros de OWASP", async () => {
    const hash = await hashPassword("x");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).toContain("m=19456");
    expect(hash).toContain("t=2");
    expect(needsRehash(hash)).toBe(false);
  });

  it("no lanza ante un hash corrupto", async () => {
    // Si lanzara, el 500 resultante le confirmaría al atacante que el usuario
    // existe. Se trata como "no coincide".
    await expect(verifyPassword("no-es-un-hash", "x")).resolves.toBe(false);
  });

  it("la verificación señuelo tarda lo mismo que una real", async () => {
    const hash = await hashPassword("cualquiera");

    // Varias rondas para promediar el ruido del sistema.
    const rondas = 5;
    let real = 0;
    let senuelo = 0;
    for (let i = 0; i < rondas; i++) {
      real += await medirMs(() => verifyPassword(hash, "incorrecta"));
      senuelo += await medirMs(() => fakeVerify());
    }

    const promedioReal = real / rondas;
    const promedioSenuelo = senuelo / rondas;

    // Sin el señuelo la diferencia sería de ~15 ms contra ~0 ms, medible desde
    // fuera: un atacante sabría qué correos tienen cuenta cronometrando.
    // Exigimos que el señuelo cueste al menos el 70 % de una verificación real.
    expect(promedioSenuelo).toBeGreaterThan(promedioReal * 0.7);
  });
});

describe("tokens opacos", () => {
  it("genera tokens únicos y de alta entropía", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
    // 32 bytes en base64url ≈ 43 caracteres.
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(42);
    }
  });

  it("hashea de forma determinista", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(generateToken()));
  });

  it("el hash no permite recuperar el token", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });

  it("compara huellas en tiempo constante", () => {
    const a = hashToken("uno");
    const b = hashToken("dos");

    expect(compareTokenHash(a, a)).toBe(true);
    expect(compareTokenHash(a, b)).toBe(false);
    // Longitudes distintas: rechaza sin lanzar.
    expect(compareTokenHash(a, "corto")).toBe(false);
  });

  it("genera códigos de respaldo legibles y normalizables", () => {
    const codigo = generateBackupCode();
    expect(codigo).toMatch(/^\d{5}-\d{5}$/);
    expect(normalizeBackupCode(codigo)).toMatch(/^\d{10}$/);
    expect(normalizeBackupCode(" 12345 - 67890 ")).toBe("1234567890");
  });
});

describe("cifrado del secreto TOTP", () => {
  it("cifra y descifra sin pérdida", () => {
    const secreto = "JBSWY3DPEHPK3PXP";
    expect(decryptSecret(encryptSecret(secreto))).toBe(secreto);
  });

  it("usa un IV nuevo en cada cifrado", () => {
    // Reutilizar el IV en AES-GCM rompe la seguridad por completo.
    const secreto = "JBSWY3DPEHPK3PXP";
    expect(encryptSecret(secreto)).not.toBe(encryptSecret(secreto));
  });

  it("detecta manipulación del valor cifrado", () => {
    // Esto es lo que aporta GCM sobre CBC: si alguien altera la fila en la base
    // de datos, el descifrado falla en vez de devolver basura silenciosamente.
    const cifrado = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret(cifrado.slice(0, -4) + "dead")).toThrow();
  });

  it("rechaza un formato inválido", () => {
    expect(() => decryptSecret("no-tiene-el-formato")).toThrow();
  });
});
