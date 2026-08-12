// Este componente envuelve onClick para bloquear el clic durante la carga, y
// un manejador de eventos no puede ejecutarse en el servidor: el servidor
// genera HTML, no responde a clics. Por eso es un Client Component.
//
// Card, Badge y Skeleton NO lo son: solo pintan, así que se renderizan en el
// servidor y su JavaScript nunca llega al navegador.
"use client";

import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // brand-600 y no brand-500: el que "parece" la marca solo da 3.90:1 con
  // texto blanco, insuficiente. Este da 5.50:1.
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "bg-surface text-ink-900 border border-border-strong hover:bg-brand-50 active:bg-brand-100",
  ghost: "bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100",
  danger: "bg-danger text-white hover:brightness-95 active:brightness-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-base gap-2",
  lg: "h-13 px-7 text-lg gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Ocupa todo el ancho disponible. Útil en formularios y en móvil. */
  fullWidth?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  fullWidth = false,
  disabled = false,
  className,
  children,
  onClick,
  ...props
}: ButtonProps): ReactElement {
  return (
    <button
      type="button"
      // aria-disabled y no `disabled` durante la carga: un botón con el
      // atributo `disabled` DESAPARECE del recorrido con Tab. Si estabas
      // navegando con teclado y pulsaste "Guardar", el foco se pierde en el
      // limbo y el lector de pantalla se queda mudo. Así sigue enfocado, se
      // anuncia como no disponible, y el clic se bloquea igual.
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
      disabled={disabled && !isLoading}
      onClick={(event) => {
        if (isLoading || disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-colors duration-150",
        // El anillo de foco se define globalmente en :focus-visible, pero se
        // refuerza aquí para que funcione también dentro de contenedores que
        // recorten el desbordamiento.
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner />
          {/* Un icono girando no le dice nada a quien no ve la pantalla. */}
          <span className="sr-only">Cargando…</span>
        </>
      ) : null}
      {children}
    </button>
  );
}

function Spinner(): ReactElement {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
