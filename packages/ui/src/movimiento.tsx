// Observa la posición del elemento en la pantalla, y eso solo ocurre en el
// navegador: el servidor genera HTML sin saber qué se ve y qué no.
"use client";

import type { CSSProperties, ElementType, ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * Revelado al entrar en pantalla.
 *
 * POR QUÉ CON IntersectionObserver Y NO CON EL EVENTO DE SCROLL. El evento de
 * scroll se dispara decenas de veces por segundo y obliga a preguntar la
 * posición del elemento en cada una, lo que fuerza al navegador a recalcular el
 * diseño entero. El observador hace ese trabajo fuera del hilo principal y solo
 * avisa cuando algo cruza el umbral.
 *
 * EL CONTENIDO SIEMPRE ESTÁ EN EL HTML. Solo se anima la opacidad y un
 * desplazamiento: nada se monta ni se desmonta. Si el JavaScript no llega a
 * cargar, el elemento se queda visible en su sitio en vez de desaparecer para
 * siempre — y el buscador lee el texto igual, porque nunca estuvo ausente.
 *
 * El movimiento reducido no se comprueba aquí: `tokens.css` ya anula las
 * duraciones de toda transición cuando el sistema lo pide, así que el elemento
 * aparece de golpe, en su sitio, sin recorrido.
 */
export interface RevelarProps {
  children: ReactNode;
  /** Etiqueta que se pinta. `div` por defecto; `li` o `section` cuando toque. */
  as?: ElementType;
  /**
   * Retraso en milisegundos. Sirve para escalonar una rejilla: la segunda
   * tarjeta entra un poco después que la primera y el conjunto se lee como un
   * movimiento, no como seis cosas saltando a la vez.
   */
  retraso?: number;
  /** Distancia que recorre al aparecer. Corta a propósito: 16px, no 60. */
  desplazamiento?: number;
  className?: string;
}

export function Revelar({
  children,
  as: Etiqueta = "div",
  retraso = 0,
  desplazamiento = 16,
  className,
}: RevelarProps): ReactElement {
  const referencia = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = referencia.current;
    if (nodo === null) return;

    // Si el navegador no trae el observador, se muestra y ya. Nunca se deja
    // contenido escondido por una capacidad que falta.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting !== true) return;
        setVisible(true);
        // Se desconecta al primer disparo: es una entrada, no un efecto que
        // deba repetirse cada vez que el elemento vuelve a pasar. Reanimar al
        // volver hacia arriba marea y hace que la página se sienta inestable.
        observador.disconnect();
      },
      // Un margen negativo abajo hace que dispare cuando el elemento está
      // realmente entrando, no en cuanto asoma un pixel por el borde.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    observador.observe(nodo);
    return () => {
      observador.disconnect();
    };
  }, []);

  const estilo: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : `translateY(${String(desplazamiento)}px)`,
    transition: `opacity var(--duracion-lenta) var(--curva-salida) ${String(retraso)}ms, transform var(--duracion-lenta) var(--curva-salida) ${String(retraso)}ms`,
    // Aviso al navegador de que estas dos van a cambiar, para que las promueva
    // a su propia capa y no repinte la página entera en cada fotograma.
    willChange: visible ? undefined : "opacity, transform",
  };

  return (
    <Etiqueta ref={referencia} style={estilo} className={className}>
      {children}
    </Etiqueta>
  );
}

/**
 * Producto flotando sobre el fondo.
 *
 * Es el efecto que pediste, y son tres capas superpuestas:
 *
 *   1. un halo radial detrás, que despega la foto del carbón y hace de "luz"
 *   2. la foto, que sube y baja muy lentamente
 *   3. una sombra elíptica debajo, que se encoge cuando el producto sube
 *
 * La tercera es la que vende el truco. Sin ella el objeto no flota: se desliza.
 * Lo que el ojo lee como altura es la sombra, no el objeto.
 *
 * DEPENDE DE LA FOTO MÁS QUE DEL CÓDIGO. Necesita el producto recortado, con
 * fondo transparente o de un color liso que se pueda quitar. Una foto con su
 * propia sombra pegada sobre una mesa se verá como lo que es: un recorte
 * cuadrado moviéndose.
 */
export interface ProductoFlotanteProps {
  children: ReactNode;
  /** Apaga el vaivén. Para miniaturas o cuando hay varios en pantalla. */
  quieto?: boolean;
  className?: string;
}

export function ProductoFlotante({
  children,
  quieto = false,
  className,
}: ProductoFlotanteProps): ReactElement {
  return (
    <div className={cn("relative grid place-items-center", className)}>
      {/* Halo. `aria-hidden` porque no significa nada: es iluminación. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, color-mix(in oklab, var(--color-brand-600) 22%, transparent), transparent 70%)",
        }}
      />

      <div className={cn("relative", !quieto && "animate-flotar")}>{children}</div>

      {/* Sombra de apoyo, sincronizada con el vaivén pero en contrafase. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-0 h-4 w-1/2 rounded-[50%] blur-md",
          !quieto && "animate-sombra-flotante",
        )}
        style={{ background: "rgba(0,0,0,0.55)" }}
      />
    </div>
  );
}
