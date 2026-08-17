import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn";

/**
 * Fila de tarjetas dispuestas sobre un ARCO de circunferencia.
 *
 * La del centro queda arriba y las de los extremos descienden, girando
 * ligeramente para seguir la tangente de la curva. Es lo que hace que un grupo
 * de tarjetas se lea como una composición y no como una fila.
 *
 * CÓMO SE CALCULA. Cada tarjeta recibe una posición `t` entre -1 y 1 según su
 * distancia al centro. La caída vertical sigue una parábola —`t²`, que a estas
 * escalas es indistinguible de un arco de círculo y no necesita trigonometría—
 * y el giro es proporcional a `t`, que es la pendiente de esa curva.
 *
 * Con número PAR de tarjetas no hay una en el centro exacto; la fórmula lo
 * resuelve sola porque `t` se reparte simétricamente.
 *
 * NO ES UN CLIENT COMPONENT: las posiciones se calculan al renderizar en el
 * servidor y viajan como estilos en el HTML. No hay JavaScript en el navegador
 * para esto.
 *
 * En pantallas estrechas el arco se anula y las tarjetas se apilan: una curva
 * de 320px de ancho no se lee como curva, se lee como desalineación.
 */
export interface CarruselArcoProps {
  children: ReactNode[];
  /** Cuánto desciende el extremo respecto al centro, en píxeles. */
  caida?: number;
  /** Giro máximo de las tarjetas de los extremos, en grados. */
  giro?: number;
  className?: string;
}

export function CarruselArco({
  children,
  caida = 64,
  giro = 7,
  className,
}: CarruselArcoProps): ReactElement {
  const total = children.length;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-6",
        // El arco solo existe a partir de tablet. Abajo se apila.
        "lg:flex-row lg:items-start lg:justify-center lg:gap-5",
        className,
      )}
      style={{ paddingBottom: `${String(caida)}px` }}
    >
      {children.map((hijo, indice) => {
        // `t` va de -1 (extremo izquierdo) a 1 (extremo derecho); 0 es el centro.
        const t = total === 1 ? 0 : (indice / (total - 1)) * 2 - 1;
        const desplazamientoY = Math.round(t * t * caida);
        const rotacion = (t * giro).toFixed(2);

        return (
          <div
            // El índice como clave es correcto aquí: la lista es fija y no se
            // reordena ni se filtra, así que la posición ES la identidad.
            key={indice}
            className="w-full lg:w-auto lg:flex-1"
            style={{
              // Las variables se leen solo en el bloque `lg`, con una consulta
              // de medios de CSS: en móvil el estilo existe pero no se aplica,
              // así que no hace falta duplicar el marcado.
              ["--y" as string]: `${String(desplazamientoY)}px`,
              ["--rot" as string]: `${rotacion}deg`,
            }}
          >
            <div className="lg:translate-y-[var(--y)] lg:rotate-[var(--rot)] lg:transition-transform lg:duration-500">
              {hijo}
            </div>
          </div>
        );
      })}
    </div>
  );
}
