import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "./cn";

// ─── Card ────────────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Eleva la tarjeta al pasar el cursor. Solo para tarjetas que son enlaces. */
  interactive?: boolean;
}

export function Card({
  interactive = false,
  className,
  children,
  ...props
}: CardProps): ReactElement {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-raised p-6",
        // La sombra tintada en brand-900 en vez de negro: una sombra gris
        // sobre fondo crema se ve sucia.
        "shadow-[0_1px_2px_rgba(62,42,33,0.05)]",
        "border border-border-subtle",
        interactive && "transition-shadow hover:shadow-[0_4px_12px_rgba(62,42,33,0.06)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONOS: Record<BadgeTone, string> = {
  // Los pasteles SOLO como fondo de elementos pequeños, siempre con ink-900
  // encima. Nunca a pantalla completa.
  neutral: "bg-surface text-ink-700 border-border-subtle",
  brand: "bg-brand-100 text-brand-800 border-brand-200",
  success: "bg-sage-300/25 text-sage-700 border-sage-300/40",
  warning: "bg-warning/25 text-ink-900 border-warning/50",
  danger: "bg-danger/15 text-danger border-danger/30",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5",
        "text-xs font-medium",
        TONOS[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Descripción de lo que se está cargando, para lectores de pantalla. */
  label?: string;
}

/**
 * Marcador de carga.
 *
 * Un esqueleto puramente visual no le dice nada a quien usa lector de
 * pantalla: solo ve una caja gris sin significado. El role="status" con texto
 * anuncia qué se está cargando.
 */
export function Skeleton({
  label = "Cargando contenido",
  className,
  ...props
}: SkeletonProps): ReactElement {
  return (
    <div
      role="status"
      className={cn("animate-pulse rounded-md bg-border-subtle/60", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Botón o enlace que ofrece la salida. */
  action?: ReactNode;
  icon?: ReactNode;
}

/**
 * Estado vacío.
 *
 * Un listado vacío sin explicación deja al usuario preguntándose si la app
 * está rota o si de verdad no hay nada. Siempre dice qué pasa y, cuando tiene
 * sentido, ofrece la salida.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon !== undefined ? (
        <div className="text-brand-300" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="text-xl text-ink-900">{title}</h3>
      {description !== undefined ? (
        // 68 caracteres es el máximo cómodo de lectura; max-w-prose lo
        // aproxima.
        <p className="max-w-prose text-ink-500">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
