import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind resolviendo conflictos.
 *
 * El problema que resuelve: en CSS gana la clase que aparece después en la
 * HOJA DE ESTILOS, no la que escribes al final del atributo. Así que
 * `<Button className="bg-red-500" />` no necesariamente sobrescribe el fondo
 * del botón.
 *
 * tailwind-merge entiende Tailwind: ve que `bg-red-500` y `bg-brand-600`
 * afectan la misma propiedad y se queda con la última. Sin esto, personalizar
 * un componente degenera en una pelea de !important.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
