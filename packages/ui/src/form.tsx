"use client";

import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import { cn } from "./cn";

interface CamposComunes {
  label: string;
  /** Texto de ayuda bajo el campo. */
  hint?: string;
  /** Mensaje de error. Su presencia marca el campo como inválido. */
  error?: string;
  /** Oculta la etiqueta visualmente, pero la mantiene para lectores. */
  labelHidden?: boolean;
}

/** Clases del control, compartidas por los tres campos. */
function clasesDeControl(hayError: boolean, extra?: string): string {
  return cn(
    "w-full rounded-md bg-surface-raised px-3 py-2.5 text-base text-ink-900",
    "placeholder:text-ink-500",
    // border-strong y no border-subtle: los bordes de controles interactivos
    // deben llegar a 3:1 (WCAG 1.4.11). El sutil solo vale para decoración.
    "border transition-colors",
    hayError ? "border-danger" : "border-border-strong hover:border-brand-400",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
    "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60",
    extra,
  );
}

/** Etiqueta, ayuda y error alrededor del control. */
function Campo({
  label,
  hint,
  error,
  labelHidden,
  controlId,
  hintId,
  errorId,
  children,
}: CamposComunes & {
  controlId: string;
  hintId: string;
  errorId: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={controlId}
        className={cn(
          "text-sm font-medium text-ink-700",
          // sr-only y no display:none: sigue existiendo para el lector de
          // pantalla, solo desaparece visualmente.
          labelHidden && "sr-only",
        )}
      >
        {label}
      </label>

      {children}

      {hint !== undefined && error === undefined ? (
        <p id={hintId} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}

      {error !== undefined ? (
        // role="alert" hace que el lector lo anuncie en cuanto aparece, sin
        // esperar a que el usuario navegue hasta él.
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-sm text-danger"
        >
          {/* El color NUNCA es el único indicador (WCAG 1.4.1): va con icono
              y con texto. Un borde rojo es invisible para quien no distingue
              el rojo del gris. */}
          <IconoError />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Conecta el control con su ayuda o su error para los lectores de pantalla. */
function describedBy(
  hint: string | undefined,
  error: string | undefined,
  hintId: string,
  errorId: string,
): string | undefined {
  if (error !== undefined) return errorId;
  if (hint !== undefined) return hintId;
  return undefined;
}

// ─── Input ───────────────────────────────────────────────────────────────────

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">, CamposComunes {}

export function Input({
  label,
  hint,
  error,
  labelHidden,
  className,
  ...props
}: InputProps): ReactElement {
  // useId genera identificadores únicos y estables. Sin la conexión
  // label ↔ input, pulsar la etiqueta no enfoca el campo y el lector de
  // pantalla lee "campo de texto, sin etiqueta".
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <Campo
      label={label}
      {...(hint === undefined ? {} : { hint })}
      {...(error === undefined ? {} : { error })}
      {...(labelHidden === undefined ? {} : { labelHidden })}
      controlId={id}
      hintId={hintId}
      errorId={errorId}
    >
      <input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy(hint, error, hintId, errorId)}
        className={clasesDeControl(error !== undefined, className)}
        {...props}
      />
    </Campo>
  );
}

// ─── Textarea ────────────────────────────────────────────────────────────────

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">, CamposComunes {}

export function Textarea({
  label,
  hint,
  error,
  labelHidden,
  className,
  rows = 4,
  ...props
}: TextareaProps): ReactElement {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <Campo
      label={label}
      {...(hint === undefined ? {} : { hint })}
      {...(error === undefined ? {} : { error })}
      {...(labelHidden === undefined ? {} : { labelHidden })}
      controlId={id}
      hintId={hintId}
      errorId={errorId}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy(hint, error, hintId, errorId)}
        className={clasesDeControl(error !== undefined, cn("resize-y", className))}
        {...props}
      />
    </Campo>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">, CamposComunes {
  children: ReactNode;
}

export function Select({
  label,
  hint,
  error,
  labelHidden,
  className,
  children,
  ...props
}: SelectProps): ReactElement {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <Campo
      label={label}
      {...(hint === undefined ? {} : { hint })}
      {...(error === undefined ? {} : { error })}
      {...(labelHidden === undefined ? {} : { labelHidden })}
      controlId={id}
      hintId={hintId}
      errorId={errorId}
    >
      <select
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy(hint, error, hintId, errorId)}
        className={clasesDeControl(
          error !== undefined,
          cn("appearance-none pr-8", className),
        )}
        {...props}
      >
        {children}
      </select>
    </Campo>
  );
}

function IconoError(): ReactElement {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-13a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
