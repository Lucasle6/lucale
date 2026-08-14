/**
 * Almacenamiento de archivos. Dos implementaciones tras una misma interfaz.
 *
 *   - disco local  → desarrollo y pruebas
 *   - Vercel Blob  → producción
 *
 * Los services dependen de la interfaz, no del proveedor, así que cambiar de
 * uno a otro no toca la lógica de negocio — el mismo patrón que el Mailer. Esa
 * decisión se tomó el Día 7 y es aquí donde se cobra: el cambio entero cabe en
 * este archivo más una línea en `app.ts`.
 *
 * POR QUÉ HIZO FALTA. El disco de un contenedor es efímero. En el plan gratuito
 * de Render cada despliegue arranca de una imagen limpia, así que `uploads/` se
 * va con el contenedor anterior y las fichas de producto se quedan con la
 * imagen rota. Sin aviso: nadie falla, simplemente los archivos ya no están.
 *
 * Decisión de seguridad que se conserva en las dos: el NOMBRE DEL ARCHIVO LO
 * GENERAMOS NOSOTROS, nunca viene del usuario. Si aceptáramos el suyo, alguien
 * subiría algo llamado `../../../etc/passwd` y escribiríamos fuera de la carpeta
 * prevista. Se llama path traversal, y se cierra no dándole al usuario ninguna
 * influencia sobre la ruta.
 */

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { del, put } from "@vercel/blob";
import type { FastifyBaseLogger } from "fastify";

export interface Storage {
  /**
   * Guarda el contenido y devuelve la URL pública.
   *
   * OJO A LA FORMA DE LA URL: la implementación local devuelve una ruta
   * RELATIVA (`/uploads/…`) y la de Vercel Blob una URL ABSOLUTA
   * (`https://…public.blob.vercel-storage.com/…`). El frontend distingue las
   * dos en `imageUrl()`; si alguna vez se añade otro proveedor, tiene que caer
   * en uno de esos dos moldes o habrá que tocar también el frontend.
   */
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

/**
 * Almacén de objetos (Vercel Blob). El que se usa en producción.
 *
 * Las imágenes viven fuera del proceso que las sirve, que es la propiedad que
 * el disco local no puede dar: sobreviven a despliegues, reinicios y a que el
 * contenedor se duerma.
 *
 * Se pasa el token explícitamente en vez de dejar que el SDK lo lea de
 * `process.env`. Cuesta un argumento y a cambio esta función no depende de
 * ninguna variable global: se puede construir con un token de prueba sin
 * ensuciar el entorno, y la validación de `env.ts` sigue siendo la única
 * puerta por la que entra la configuración.
 */
export function createBlobStorage(token: string): Storage {
  /** Carpeta dentro del almacén. Deja sitio a otros usos sin mezclarlo todo. */
  const CARPETA = "productos";

  return {
    async save(buffer, extension) {
      const { url } = await put(`${CARPETA}/${randomUUID()}.${extension}`, buffer, {
        // Público a propósito: son fotos de un catálogo abierto. Un almacén
        // privado obligaría a que CADA imagen pasara por nuestro servidor para
        // ser reenviada, convirtiendo un acierto de CDN en trabajo y latencia.
        access: "public",
        token,
        // `addRandomSuffix` se queda en su valor por defecto (false) A
        // PROPÓSITO. El nombre ya es un UUID nuestro, así que no hay colisión
        // posible; y si alguna vez la hubiera, el SDK lanza en vez de
        // sobrescribir en silencio. Un error ruidoso es mejor que una imagen
        // que desaparece sin que nadie se entere.
      });

      return url;
    },

    async remove(url) {
      // Aquí NO hace falta el `basename` defensivo de la versión local: no se
      // construye ninguna ruta de sistema de archivos con esto. La URL se manda
      // tal cual al SDK, y una manipulada simplemente no corresponde a ningún
      // objeto de nuestro almacén.
      //
      // `del` tampoco lanza si el objeto ya no existe, que es exactamente el
      // contrato que pide la interfaz: el objetivo era que no estuviera.
      await del(url, { token });
    },
  };
}

export { UPLOAD_DIR };
