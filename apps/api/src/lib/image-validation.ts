/**
 * Validación de imágenes subidas (control de seguridad nº 13).
 *
 * EL ATAQUE: alguien sube un archivo llamado "foto.png" cuyo contenido real es
 * `<?php system($_GET["cmd"]); ?>`. Si el servidor lo interpreta, acaba de
 * ejecutar código del atacante.
 *
 * POR QUÉ NO BASTA MIRAR EL NOMBRE:
 *
 *   ✗ la extensión del archivo   → la elige quien sube
 *   ✗ la cabecera Content-Type   → la envía quien sube
 *   ✓ los primeros bytes         → los define el formato real
 *
 * Las dos primeras las controla el atacante. Solo la tercera dice la verdad.
 *
 * Se aplican tres capas:
 *   1. Tamaño máximo, antes de leer nada.
 *   2. Magic bytes: los primeros bytes deben ser la firma de un formato válido.
 *   3. Reprocesado con sharp, que además de confirmar que la imagen es
 *      decodificable BORRA los metadatos EXIF.
 */

import sharp from "sharp";
import { ValidationError } from "./errors.js";

/** 5 MB. Suficiente para una foto de producto de buena calidad. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Dimensión máxima del lado mayor. Reduce peso y coste de ancho de banda. */
const MAX_DIMENSION = 2000;

export type ImageFormat = "png" | "jpeg" | "webp" | "gif";

/**
 * Firmas de los formatos aceptados.
 *
 * Estos bytes SON el formato, no una etiqueta sobre él. `offset` existe porque
 * WebP no empieza por su firma: los primeros 4 bytes son "RIFF", luego 4 del
 * tamaño, y en el byte 8 aparece "WEBP".
 */
const FIRMAS: { format: ImageFormat; offset: number; bytes: number[] }[] = [
  { format: "png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: "jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { format: "webp", offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
  { format: "gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
];

/** Marca que confirma que un RIFF es WebP y no, por ejemplo, un WAV. */
const WEBP_MARCA = [0x57, 0x45, 0x42, 0x50]; // "WEBP" en el byte 8

function coincide(buffer: Buffer, offset: number, bytes: number[]): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Detecta el formato real leyendo los primeros bytes.
 * Devuelve null si no coincide con ningún formato aceptado.
 */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  for (const firma of FIRMAS) {
    if (!coincide(buffer, firma.offset, firma.bytes)) continue;

    // RIFF es un contenedor genérico: también lo usan los WAV. Hay que
    // confirmar la marca "WEBP" del byte 8.
    if (firma.format === "webp" && !coincide(buffer, 8, WEBP_MARCA)) {
      continue;
    }
    return firma.format;
  }
  return null;
}

export interface ImagenProcesada {
  /** Imagen reprocesada: sin EXIF y con tamaño acotado. */
  buffer: Buffer;
  format: "webp";
  width: number;
  height: number;
  bytes: number;
}

/**
 * Valida y reprocesa una imagen subida.
 *
 * El reprocesado con sharp no es opcional ni cosmético:
 *
 *   - Confirma que el archivo es una imagen DECODIFICABLE, no solo que empieza
 *     con los bytes correctos. Alguien podría anteponer una firma PNG válida a
 *     contenido malicioso; al reprocesar, eso falla.
 *   - Borra los metadatos EXIF. Una foto tomada con el teléfono suele llevar
 *     las COORDENADAS GPS de dónde se tomó: si subes fotos de tus productos
 *     desde casa, estarías publicando tu dirección.
 *   - Normaliza todo a WebP, que pesa bastante menos que PNG o JPEG.
 */
export async function validateAndProcessImage(buffer: Buffer): Promise<ImagenProcesada> {
  if (buffer.length === 0) {
    throw new ValidationError("El archivo está vacío");
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `La imagen pesa más de ${String(MAX_IMAGE_BYTES / 1024 / 1024)} MB`,
    );
  }

  // Capa 2: los primeros bytes deben ser de un formato aceptado.
  const formato = detectImageFormat(buffer);
  if (formato === null) {
    // El mensaje no revela QUÉ contenía el archivo: eso le diría al atacante
    // cuánto sabemos de su intento.
    throw new ValidationError(
      "El archivo no es una imagen válida (se aceptan PNG, JPEG, WebP y GIF)",
    );
  }

  // Capa 3: reprocesado. Aquí es donde un archivo con firma falsificada muere.
  try {
    const procesada = sharp(buffer, { failOn: "error" })
      .rotate() // aplica la orientación EXIF antes de descartarla
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        // No agranda las imágenes pequeñas: solo reduce las grandes.
        withoutEnlargement: true,
      })
      .webp({ quality: 82 });

    const { data, info } = await procesada.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      format: "webp",
      width: info.width,
      height: info.height,
      bytes: data.length,
    };
  } catch {
    throw new ValidationError("No se pudo procesar la imagen: puede estar dañada");
  }
}
