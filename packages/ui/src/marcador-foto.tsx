import type { ReactElement } from "react";
import { cn } from "./cn";

/**
 * Marcador de foto de producto.
 *
 * PROVISIONAL, hasta la sesión de fotos. Está aquí y no como archivo de imagen
 * por tres razones:
 *
 *   1. No es una foto de banco. Usar la foto de las salsas de otra marca se ve
 *      bien hoy y es un problema el día que alguien la reconozca.
 *   2. Es vectorial: nítido en cualquier tamaño y pesa menos que un JPEG.
 *   3. Se borra de un sitio. Cuando lleguen las fotos, este componente deja de
 *      usarse y no queda basura suelta en `public/`.
 *
 * NO ALEATORIO. La variante se deriva del texto que se le pasa —el slug del
 * producto—, así que el servidor y el navegador pintan exactamente lo mismo.
 * Con `Math.random()` el HTML del servidor no coincidiría con el del cliente y
 * React lo rechazaría al hidratar.
 */
export interface MarcadorFotoProps {
  /** Slug o nombre. Decide la silueta y el tono, de forma estable. */
  semilla: string;
  /** Texto accesible. Si se omite, se marca como decorativo. */
  alt?: string;
  className?: string;
}

/** Suma de caracteres. No es un hash serio; solo reparte de forma estable. */
function indiceDe(texto: string, entre: number): number {
  let suma = 0;
  for (let i = 0; i < texto.length; i += 1) suma += texto.charCodeAt(i);
  return suma % entre;
}

/**
 * Tres siluetas, para que una rejilla de seis productos no parezca el mismo
 * azulejo repetido: frasco ancho (salsa), botella alta (aceite) y tarro bajo.
 */
const SILUETAS = [
  // Frasco de salsa: hombros anchos, cuello corto.
  "M34 30h32v8l6 6v40a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V44l6-6z",
  // Botella de aceite: cuello largo y estrecho.
  "M44 22h12v22l8 12v34a6 6 0 0 1-6 6H42a6 6 0 0 1-6-6V56l8-12z",
  // Tarro bajo y ancho, tipo conserva.
  "M32 34h36v6l4 4v40a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V44l4-4z",
];

export function MarcadorFoto({
  semilla,
  alt,
  className,
}: MarcadorFotoProps): ReactElement {
  const variante = indiceDe(semilla, SILUETAS.length);
  const silueta = SILUETAS[variante] ?? SILUETAS[0];
  // Un giro de tono pequeño: suficiente para distinguirlas, no tanto como para
  // que la rejilla parezca un semáforo.
  const giro = indiceDe(semilla, 5) * 9 - 18;
  const decorativo = alt === undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-full w-full", className)}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : alt}
      aria-hidden={decorativo ? "true" : undefined}
      style={{ filter: `hue-rotate(${String(giro)}deg)` }}
    >
      <defs>
        {/* El identificador incluye la semilla: dos marcadores en la misma
            página no pueden compartir id, o el segundo hereda el degradado del
            primero. */}
        <radialGradient id={`halo-${semilla}`} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="var(--color-brand-600)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-brand-600)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill="var(--color-surface)" />
      <rect width="100" height="100" fill={`url(#halo-${semilla})`} />

      {/* Silueta rellena y perfilada: sin el perfil se ve como una mancha. */}
      <path
        d={silueta}
        fill="var(--color-surface-raised)"
        stroke="var(--color-border-strong)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Etiqueta del frasco. Es lo que lo hace leer como producto y no como
          una forma cualquiera. */}
      <rect
        x="36"
        y="62"
        width="28"
        height="18"
        rx="2"
        fill="var(--color-brand-600)"
        opacity="0.28"
      />
    </svg>
  );
}
