import { Button, MarcadorFoto, ProductoFlotante, Revelar } from "@bodegon/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { imageUrl } from "../lib/api";

/**
 * Hero de la portada.
 *
 * EL MOVIMIENTO NO ES UN GIF, y es deliberado. Un GIF de fondo pesa varios
 * megabytes, se pixela en cuanto la pantalla es grande, y no hay forma de
 * detenerlo para quien configuró su sistema pidiendo menos movimiento. Aquí el
 * movimiento son tres capas de luz desplazándose con CSS: no añade un solo byte
 * de descarga, es nítido a cualquier resolución, y se detiene solo porque
 * `tokens.css` anula las animaciones cuando el sistema lo pide.
 *
 * Si después de la sesión de fotos quieres un vídeo real —una salsa cayendo,
 * vapor— se sustituye la capa de luz por un `<video muted playsInline>` y el
 * resto del componente no cambia.
 *
 * Es un Server Component: no tiene estado ni escucha eventos, así que su
 * JavaScript nunca llega al navegador. Solo `Revelar`, que va dentro, es cliente.
 */
export interface HeroProps {
  /**
   * Producto a destacar. Si no hay, entra el marcador provisional.
   *
   * Lleva `| undefined` explícito además del `?` por `exactOptionalPropertyTypes`:
   * con esa opción, el `?` significa "la prop puede no venir", pero NO permite
   * pasarla valiendo `undefined`. La portada calcula el destacado y puede
   * quedarse sin ninguno, así que necesita poder pasarlo vacío.
   */
  destacado?: { nombre: string; slug: string; imagenUrl: string | null } | undefined;
}

export function Hero({ destacado }: HeroProps): ReactElement {
  return (
    <section className="relative overflow-hidden">
      {/* ── Capas de luz ────────────────────────────────────────────────────
          `aria-hidden` y `pointer-events-none`: son iluminación, no contenido.
          No significan nada para un lector de pantalla y no deben interceptar
          ningún clic.

          `overflow-hidden` en la sección las recorta: se desplazan más allá del
          borde a propósito, y sin el recorte alargarían la página a lo ancho. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-1/3 left-[8%] h-[46rem] w-[46rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--color-brand-600) 26%, transparent), transparent 68%)",
            animation: "deriva-a 28s var(--curva-suave) infinite",
          }}
        />
        <div
          className="absolute -right-[12%] bottom-[-20%] h-[38rem] w-[38rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--color-sage-700) 20%, transparent), transparent 70%)",
            animation: "deriva-b 34s var(--curva-suave) infinite",
          }}
        />
        <div
          className="absolute top-[10%] right-[26%] h-[22rem] w-[22rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--color-brand-800) 30%, transparent), transparent 72%)",
            animation: "latido-tenue 22s var(--curva-suave) infinite",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <Revelar>
            <p className="text-sm tracking-widest text-brand-700 uppercase">
              Hechas con calma
            </p>
          </Revelar>

          {/* Escalonado: el rótulo, el titular y el párrafo entran uno detrás de
              otro. Leído así se percibe como una frase que se compone, no como
              tres bloques que aparecen a la vez. */}
          <Revelar retraso={90}>
            <h1 className="mt-4 max-w-2xl font-display text-5xl leading-[1.05] text-ink-900 sm:text-6xl">
              Salsas y aceites para cocinar todos los días
            </h1>
          </Revelar>

          <Revelar retraso={180}>
            <p className="mt-6 max-w-prose text-lg text-ink-700">
              Chiles tostados en comal y aceites infusionados en frío, en tandas pequeñas.
              Sin conservadores, sin prisa.
            </p>
          </Revelar>

          <Revelar retraso={260}>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/productos">
                <Button size="lg">Ver el catálogo</Button>
              </Link>
              <Link href="/productos?categoria=machas">
                <Button size="lg" variant="secondary">
                  Empezar por las machas
                </Button>
              </Link>
            </div>
          </Revelar>
        </div>

        {/* El producto flotando, que es lo que ancla la composición. */}
        <Revelar retraso={140} desplazamiento={28}>
          <ProductoFlotante className="mx-auto max-w-sm">
            {destacado?.imagenUrl == null ? (
              <div className="aspect-[3/4] w-full">
                <MarcadorFoto
                  semilla={destacado?.slug ?? "lucale"}
                  alt="Foto de producto pendiente de la sesión"
                />
              </div>
            ) : (
              <img
                src={imageUrl(destacado.imagenUrl)}
                alt={destacado.nombre}
                className="max-h-[30rem] w-full object-contain"
                loading="eager"
              />
            )}
          </ProductoFlotante>
        </Revelar>
      </div>
    </section>
  );
}
