/**
 * Generación de slugs para URLs.
 *
 * Vive en el paquete compartido porque el formulario del panel muestra una
 * vista previa del slug mientras escribes, y debe coincidir exactamente con lo
 * que calculará el servidor. Dos implementaciones separadas divergirían.
 */

/**
 * Convierte un texto en slug: "Maceta Hexagonal" → "maceta-hexagonal".
 *
 * El paso clave es `normalize("NFD")`, que descompone los caracteres
 * acentuados en letra + tilde ("á" → "a" + "´"). Luego se borran las tildes
 * sueltas. Sin esto, "Lámpara" produciría "l-mpara": el acento no es ASCII y
 * caería junto con los espacios.
 */
export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      // Elimina los diacríticos ya separados por la normalización.
      .replace(/[̀-ͯ]/g, "")
      // La ñ tiene su propio punto de código y no se descompone: se traduce a mano.
      .replace(/ñ/gi, "n")
      .toLowerCase()
      .trim()
      // Todo lo que no sea letra o número se vuelve separador.
      .replace(/[^a-z0-9]+/g, "-")
      // Sin guiones dobles ni guiones al principio o al final.
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
  );
}

/**
 * Añade un sufijo numérico para desempatar: "maceta" → "maceta-2".
 *
 * Se usa cuando el slug generado ya existe. Se corta el nombre base si hace
 * falta para no pasarse del límite de la columna.
 */
export function slugWithSuffix(base: string, suffix: number, maxLength = 120): string {
  const sufijo = `-${String(suffix)}`;
  return `${base.slice(0, maxLength - sufijo.length)}${sufijo}`;
}
