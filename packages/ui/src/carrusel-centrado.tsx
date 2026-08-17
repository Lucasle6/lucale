"use client";

import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * Carrusel con el elemento central destacado y los laterales difuminados.
 *
 * Se ven tres a la vez: el del medio a tamaño y opacidad plenos, y los dos de
 * los lados asomando, atenuados. Esa asimetría es la que invita a arrastrar —
 * un carrusel donde todo se ve igual parece una lista y nadie lo toca.
 *
 * EL DIFUMINADO ES UNA MÁSCARA CSS, no un degradado encima. Un degradado del
 * color del fondo puesto sobre las tarjetas se ve bien hasta que la sección
 * cambia de color y aparece un rectángulo. `mask-image` recorta el elemento de
 * verdad, así que funciona sobre cualquier fondo.
 *
 * `scroll-snap-align: center` en las tarjetas es lo que hace que siempre quede
 * una centrada al soltar, en vez de a medio camino.
 */
export interface CarruselCentradoProps {
  children: ReactNode;
  /** Se anuncia a lectores de pantalla. Describe qué se recorre. */
  etiqueta: string;
  className?: string;
}

export function CarruselCentrado({
  children,
  etiqueta,
  className,
}: CarruselCentradoProps): ReactElement {
  const pista = useRef<HTMLDivElement>(null);
  const [enIzquierda, setEnIzquierda] = useState(false);
  const [enDerecha, setEnDerecha] = useState(false);

  const revisar = useCallback(() => {
    const nodo = pista.current;
    if (nodo === null) return;
    setEnIzquierda(nodo.scrollLeft > 1);
    setEnDerecha(nodo.scrollLeft + nodo.clientWidth < nodo.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const nodo = pista.current;
    if (nodo === null) return;

    // Arranca centrado: con 5 elementos, el tercero queda en medio y se ven dos
    // asomando a cada lado, que es la composición que se busca.
    nodo.scrollLeft = (nodo.scrollWidth - nodo.clientWidth) / 2;

    revisar();
    nodo.addEventListener("scroll", revisar, { passive: true });
    const observador = new ResizeObserver(revisar);
    observador.observe(nodo);

    return () => {
      nodo.removeEventListener("scroll", revisar);
      observador.disconnect();
    };
  }, [revisar]);

  function mover(direccion: -1 | 1): void {
    const nodo = pista.current;
    if (nodo === null) return;
    const tarjeta = nodo.querySelector("[data-tarjeta]");
    // Se avanza EXACTAMENTE una tarjeta, medida del DOM y no adivinada: así el
    // snap no pelea con el desplazamiento y no queda nada a medio camino.
    const paso =
      tarjeta instanceof HTMLElement ? tarjeta.offsetWidth + 24 : nodo.clientWidth * 0.6;
    nodo.scrollBy({ left: direccion * paso, behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={pista}
        role="region"
        aria-label={etiqueta}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-[calc(50%-9rem)] py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          // La máscara desvanece 18% por cada lado. Es lo que hace que el
          // primero y el último "entren" en vez de aparecer cortados.
          maskImage:
            "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
        }}
      >
        {children}
      </div>

      <Flecha
        lado="izquierda"
        activa={enIzquierda}
        onClick={() => {
          mover(-1);
        }}
      />
      <Flecha
        lado="derecha"
        activa={enDerecha}
        onClick={() => {
          mover(1);
        }}
      />
    </div>
  );
}

function Flecha({
  lado,
  activa,
  onClick,
}: {
  lado: "izquierda" | "derecha";
  activa: boolean;
  onClick: () => void;
}): ReactElement {
  const esIzquierda = lado === "izquierda";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!activa}
      aria-hidden={!activa}
      tabIndex={activa ? 0 : -1}
      aria-label={esIzquierda ? "Anterior" : "Siguiente"}
      className={cn(
        "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full",
        "border border-border-strong bg-surface-raised text-ink-900 shadow-lg",
        "transition-opacity hover:border-brand-600",
        esIzquierda ? "left-2 sm:left-6" : "right-2 sm:right-6",
        activa ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d={esIzquierda ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
