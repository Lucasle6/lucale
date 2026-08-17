/**
 * @bodegon/ui — design system compartido entre la tienda y el panel.
 *
 * Los componentes viven aquí, no dentro de una app, porque las dos los usan.
 * Un botón definido una vez, con su accesibilidad resuelta una vez.
 *
 * Los tokens de color y tipografía NO están aquí: viven en el CSS de cada app
 * (apps/web/src/app/globals.css), porque Tailwind v4 los define con @theme.
 * Ver docs/04-design-system.md.
 */

export { cn } from "./cn";

export { Button } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./button";

export { Input, Select, Textarea } from "./form";
export type { InputProps, SelectProps, TextareaProps } from "./form";

export { CarruselArco } from "./carrusel-arco";
export type { CarruselArcoProps } from "./carrusel-arco";

export { CarruselCentrado } from "./carrusel-centrado";
export type { CarruselCentradoProps } from "./carrusel-centrado";

export { Carrusel } from "./carrusel";
export type { CarruselProps } from "./carrusel";

export { MarcadorFoto } from "./marcador-foto";
export type { MarcadorFotoProps } from "./marcador-foto";

export { ProductoFlotante, Revelar } from "./movimiento";
export type { ProductoFlotanteProps, RevelarProps } from "./movimiento";

export { Badge, Card, EmptyState, Skeleton } from "./display";
export type {
  BadgeProps,
  BadgeTone,
  CardProps,
  EmptyStateProps,
  SkeletonProps,
} from "./display";
