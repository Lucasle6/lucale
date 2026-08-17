// Mide la posición del scroll para saber si quedan elementos a los lados, y eso
// solo existe en el navegador.
"use client";

import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * Carrusel horizontal.
 *
 * EL DESPLAZAMIENTO ES NATIVO, no calculado en JavaScript. La pista es un
 * contenedor con `overflow-x: auto` y `scroll-snap`, así que:
 *
 *   - funciona con el dedo en móvil sin escribir nada,
 *   - funciona con la rueda del ratón y el trackpad,
 *   - se puede recorrer con el teclado,
 *   - y si el JavaScript falla, sigue siendo una lista que se desliza.
 *
 * Lo único que aporta el JavaScript son las flechas y saber cuándo ocultarlas.
 * Un carrusel que reimplementa el scroll a mano pierde las cuatro cosas de
 * arriba y encima suele quedar inutilizable con teclado.
 *
 * NO AVANZA SOLO. Un carrusel automático mueve el contenido justo cuando
 * alguien está leyéndolo, y para quien navega con teclado es una trampa: el
 * foco se va con el elemento. Si hace falta, se añade con un botón de pausa —
 * nunca sin él.
 */
export interface CarruselProps {
  children: ReactNode;
  /** Se anuncia a lectores de pantalla. Obligatorio: describe qué se recorre. */
  etiqueta: string;
  className?: string;
}

export function Carrusel({ children, etiqueta, className }: CarruselProps): ReactElement {
  const pista = useRef<HTMLDivElement>(null);
  const [puedeIzquierda, setPuedeIzquierda] = useState(false);
  const [puedeDerecha, setPuedeDerecha] = useState(false);

  const revisarBordes = useCallback(() => {
    const nodo = pista.current;
    if (nodo === null) return;
    // El margen de 1px absorbe los redondeos a fracción de pixel que hacen los
    // navegadores al ampliar la página: sin él, la flecha derecha se queda
    // encendida para siempre al final del recorrido.
    setPuedeIzquierda(nodo.scrollLeft > 1);
    setPuedeDerecha(nodo.scrollLeft + nodo.clientWidth < nodo.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const nodo = pista.current;
    if (nodo === null) return;

    revisarBordes();
    nodo.addEventListener("scroll", revisarBordes, { passive: true });

    // También al cambiar el tamaño: en una ventana ancha puede que ya no haya
    // nada que desplazar y las flechas sobren.
    const observador = new ResizeObserver(revisarBordes);
    observador.observe(nodo);

    return () => {
      nodo.removeEventListener("scroll", revisarBordes);
      observador.disconnect();
    };
  }, [revisarBordes]);

  function mover(direccion: -1 | 1): void {
    const nodo = pista.current;
    if (nodo === null) return;
    // Se avanza el 85% de lo visible, no el 100%: dejar un trozo del elemento
    // siguiente a la vista es lo que le dice al ojo que hay más.
    nodo.scrollBy({ left: direccion * nodo.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={pista}
        // `region` + nombre: un lector de pantalla lo anuncia como una zona con
        // entidad propia y permite saltar a ella.
        role="region"
        aria-label={etiqueta}
        // tabIndex 0 porque es un contenedor desplazable: sin esto no se puede
        // recorrer con las flechas del teclado, y el contenido queda inalcanzable
        // para quien no usa ratón.
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <Flecha
        direccion="izquierda"
        visible={puedeIzquierda}
        onClick={() => {
          mover(-1);
        }}
      />
      <Flecha
        direccion="derecha"
        visible={puedeDerecha}
        onClick={() => {
          mover(1);
        }}
      />
    </div>
  );
}

function Flecha({
  direccion,
  visible,
  onClick,
}: {
  direccion: "izquierda" | "derecha";
  visible: boolean;
  onClick: () => void;
}): ReactElement {
  const esIzquierda = direccion === "izquierda";

  return (
    <button
      type="button"
      onClick={onClick}
      // `aria-hidden` y `tabIndex -1` cuando no sirve: se oculta a la vista Y se
      // saca del recorrido del teclado. Un botón invisible pero enfocable deja
      // al usuario "atascado" en un control que no ve.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      disabled={!visible}
      aria-label={esIzquierda ? "Desplazar a la izquierda" : "Desplazar a la derecha"}
      className={cn(
        "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full",
        "border border-border-strong bg-surface-raised text-ink-900 shadow-lg",
        "transition-opacity hover:border-brand-600",
        esIzquierda ? "-left-3" : "-right-3",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
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
