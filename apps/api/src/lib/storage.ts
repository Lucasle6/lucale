/**
 * Almacenamiento de archivos.
 *
 * Hoy guarda en disco; en la Semana 3 será Cloudflare R2. Los services
 * dependen de esta interfaz, no del proveedor, así que el cambio no toca la
 * lógica de negocio — el mismo patrón que el Mailer.
 *
 * Decisión de seguridad: el NOMBRE DEL ARCHIVO LO GENERAMOS NOSOTROS, nunca
 * viene del usuario. Si aceptáramos el suyo, alguien subiría algo llamado
 * `../../../etc/passwd` y escribiríamos fuera de la carpeta prevista. Se llama
 * path traversal, y se cierra no dándole al usuario ninguna influencia sobre
 * la ruta.
 */

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyBaseLogger } from "fastify";

export interface Storage {
  /** Guarda el contenido y devuelve la URL pública. */
  save(buffer: Buffer, extension: string): Promise<string>;
  /** Borra un archivo por su URL. No lanza si ya no existe. */
  remove(url: string): Promise<void>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../..");
/** `uploads/` está en el .gitignore desde el Día 1. */
const UPLOAD_DIR = path.join(repoRoot, "uploads");

/** Prefijo de las URLs públicas. En producción será el dominio de R2. */
const PUBLIC_PREFIX = "/uploads";

export function createLocalStorage(log: FastifyBaseLogger): Storage {
  return {
    async save(buffer, extension) {
      await mkdir(UPLOAD_DIR, { recursive: true });

      // Nombre generado, no el del usuario. Un UUID no puede contener "../"
      // ni caracteres que escapen de la carpeta.
      const nombre = `${randomUUID()}.${extension}`;
      await writeFile(path.join(UPLOAD_DIR, nombre), buffer);

      return `${PUBLIC_PREFIX}/${nombre}`;
    },

    async remove(url) {
      // Solo se toma el nombre base de la URL, descartando cualquier ruta que
      // venga dentro: defensa en profundidad por si una URL manipulada llegara
      // hasta aquí desde la base de datos.
      const nombre = path.basename(url);
      try {
        await unlink(path.join(UPLOAD_DIR, nombre));
      } catch (error) {
        // Que el archivo ya no exista no es un fallo: el objetivo era que no
        // estuviera.
        log.warn({ err: error, url }, "No se pudo borrar el archivo subido");
      }
    },
  };
}

export { UPLOAD_DIR };
