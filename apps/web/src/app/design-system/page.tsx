import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@bodegon/ui";
import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

export const metadata: Metadata = {
  title: "Design system",
  // Página interna de referencia: no debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

/**
 * Escaparate del design system.
 *
 * Existe para ver todos los componentes juntos, en todos sus estados. Sirve
 * para dos cosas: revisar de un vistazo que el conjunto es coherente, y
 * detectar inconsistencias antes de que se propaguen por la aplicación.
 */
export default function DesignSystemPage(): ReactElement {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-16">
        <p className="text-sm font-medium tracking-wide text-brand-600 uppercase">
          LuCaLe
        </p>
        <h1 className="mt-2 text-4xl text-ink-900">Design system</h1>
        <p className="mt-3 max-w-prose text-lg text-ink-700">
          Paleta sobria de blancos, cremas y pasteles. Todos los contrastes están
          calculados con la fórmula WCAG 2.1, no estimados a ojo.
        </p>
      </header>

      <Seccion titulo="Paleta">
        <div className="grid gap-6">
          <Muestrario
            titulo="Neutrales cálidos"
            colores={[
              { nombre: "bg", clase: "bg-bg", nota: "fondo de página" },
              { nombre: "surface", clase: "bg-surface", nota: "tarjetas" },
              {
                nombre: "border-subtle",
                clase: "bg-border-subtle",
                nota: "1.34:1 decorativo",
              },
              {
                nombre: "border-strong",
                clase: "bg-border-strong",
                nota: "3.10:1 ✓ controles",
              },
              { nombre: "ink-500", clase: "bg-ink-500", nota: "5.04:1 ✓ AA" },
              { nombre: "ink-700", clase: "bg-ink-700", nota: "9.53:1 ✓ AAA" },
              { nombre: "ink-900", clase: "bg-ink-900", nota: "14.62:1 ✓ AAA" },
            ]}
          />
          <Muestrario
            titulo="Marca — terracota"
            colores={[
              { nombre: "brand-100", clase: "bg-brand-100", nota: "fondo de badge" },
              { nombre: "brand-300", clase: "bg-brand-300", nota: "decorativo" },
              {
                nombre: "brand-500",
                clase: "bg-brand-500",
                nota: "3.90:1 ✗ texto blanco",
              },
              { nombre: "brand-600", clase: "bg-brand-600", nota: "5.50:1 ✓ botón" },
              { nombre: "brand-700", clase: "bg-brand-700", nota: "7.57:1 ✓ foco" },
              { nombre: "brand-900", clase: "bg-brand-900", nota: "base de sombras" },
            ]}
          />
          <Muestrario
            titulo="Semánticos y pasteles"
            colores={[
              { nombre: "success", clase: "bg-success", nota: "4.91:1 ✓" },
              { nombre: "warning", clase: "bg-warning", nota: "9.35:1 ✓ con ink-900" },
              { nombre: "danger", clase: "bg-danger", nota: "4.90:1 ✓" },
              { nombre: "sage-300", clase: "bg-sage-300", nota: "decorativo" },
              { nombre: "pastel-mauve", clase: "bg-pastel-mauve", nota: "fondo pequeño" },
              { nombre: "pastel-blue", clase: "bg-pastel-blue", nota: "fondo pequeño" },
              { nombre: "pastel-peach", clase: "bg-pastel-peach", nota: "fondo pequeño" },
            ]}
          />
        </div>
      </Seccion>

      <Seccion titulo="Tipografía">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1 text-xs text-ink-500">Fraunces · títulos</p>
              <h2 className="text-3xl text-ink-900">Maceta Hexagonal</h2>
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-500">Inter · cuerpo</p>
              <p className="max-w-prose text-ink-700">
                Maceta geométrica de líneas limpias, ideal para suculentas. Impresa en PLA
                mate con acabado texturizado. La longitud de línea se limita a unos 68
                caracteres, que es el máximo cómodo de lectura.
              </p>
            </div>
          </div>
        </Card>
      </Seccion>

      <Seccion titulo="Botones">
        <div className="flex flex-col gap-6">
          <Fila etiqueta="Variantes">
            <Button variant="primary">Agregar al carrito</Button>
            <Button variant="secondary">Ver detalles</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger">Eliminar</Button>
          </Fila>
          <Fila etiqueta="Tamaños">
            <Button size="sm">Pequeño</Button>
            <Button size="md">Mediano</Button>
            <Button size="lg">Grande</Button>
          </Fila>
          <Fila etiqueta="Estados">
            <Button isLoading>Guardando</Button>
            <Button disabled>Sin stock</Button>
            <Button variant="secondary" disabled>
              No disponible
            </Button>
          </Fila>
        </div>
      </Seccion>

      <Seccion titulo="Formularios">
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Correo electrónico" type="email" placeholder="tu@correo.com" />
            <Input
              label="Contraseña"
              type="password"
              hint="Mínimo 12 caracteres. Una frase es mejor que símbolos."
            />
            <Input
              label="Código postal"
              defaultValue="0000"
              error="Debe tener 5 dígitos"
            />
            <Select label="Tamaño" defaultValue="">
              <option value="" disabled>
                Elige un tamaño
              </option>
              <option value="s">Pequeña — $149.90</option>
              <option value="m">Mediana — $219.90</option>
              <option value="l">Grande — $319.90</option>
            </Select>
            <div className="sm:col-span-2">
              <Textarea
                label="Notas del pedido"
                placeholder="¿Algo que debamos saber?"
                hint="Opcional"
              />
            </div>
          </div>
        </Card>
      </Seccion>

      <Seccion titulo="Etiquetas">
        <div className="flex flex-wrap gap-2">
          <Badge>Borrador</Badge>
          <Badge tone="brand">Nuevo</Badge>
          <Badge tone="success">En stock</Badge>
          <Badge tone="warning">Pocas piezas</Badge>
          <Badge tone="danger">Agotado</Badge>
        </div>
      </Seccion>

      <Seccion titulo="Tarjetas">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card interactive>
            <h3 className="text-xl text-ink-900">Lámpara Luna</h3>
            <p className="mt-1 text-sm text-ink-500">Decoración</p>
            <p className="mt-3 text-lg font-medium text-ink-900">desde $449.90</p>
            <div className="mt-4">
              <Badge tone="success">En stock</Badge>
            </div>
          </Card>
          <Card>
            <h3 className="text-xl text-ink-900">Cargando…</h3>
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" label="Cargando nombre del producto" />
              <Skeleton className="h-4 w-1/2" label="Cargando precio" />
              <Skeleton className="h-24 w-full" label="Cargando imagen" />
            </div>
          </Card>
        </div>
      </Seccion>

      <Seccion titulo="Estado vacío">
        <Card className="p-0">
          <EmptyState
            title="Tu carrito está vacío"
            description="Cuando agregues piezas aparecerán aquí. Empieza por el catálogo."
            action={<Button>Ver catálogo</Button>}
            icon={
              <svg
                className="size-12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                />
              </svg>
            }
          />
        </Card>
      </Seccion>

      <Seccion titulo="Accesibilidad">
        <Card>
          <ul className="flex flex-col gap-2 text-ink-700">
            <Punto>
              Recorre esta página con <kbd className={KBD}>Tab</kbd>: cada elemento
              enfocable muestra un anillo de 2 px en brand-700.
            </Punto>
            <Punto>
              El botón «Guardando» usa <code className={CODE}>aria-disabled</code> y no{" "}
              <code className={CODE}>disabled</code>, para no desaparecer del recorrido
              con teclado mientras carga.
            </Punto>
            <Punto>
              El campo con error lo anuncia con{" "}
              <code className={CODE}>role=&quot;alert&quot;</code>, con icono y con texto:
              el color nunca es el único indicador.
            </Punto>
            <Punto>
              Los esqueletos de carga llevan{" "}
              <code className={CODE}>role=&quot;status&quot;</code> y texto oculto, porque
              una caja gris no significa nada para un lector de pantalla.
            </Punto>
          </ul>
        </Card>
      </Seccion>
    </main>
  );
}

const KBD =
  "rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-xs";
const CODE = "rounded bg-surface px-1 py-0.5 font-mono text-sm text-brand-700";

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="mb-14">
      <h2 className="mb-5 border-b border-border-subtle pb-2 text-2xl text-ink-900">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Fila({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div>
      <p className="mb-2 text-xs tracking-wide text-ink-500 uppercase">{etiqueta}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Muestrario({
  titulo,
  colores,
}: {
  titulo: string;
  colores: { nombre: string; clase: string; nota: string }[];
}): ReactElement {
  return (
    <div>
      <p className="mb-2 text-xs tracking-wide text-ink-500 uppercase">{titulo}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {colores.map((color) => (
          <div key={color.nombre} className="flex flex-col gap-1.5">
            <div
              className={`h-14 rounded-md border border-border-subtle ${color.clase}`}
              aria-hidden="true"
            />
            <p className="font-mono text-xs text-ink-900">{color.nombre}</p>
            <p className="text-xs text-ink-500">{color.nota}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Punto({ children }: { children: ReactNode }): ReactElement {
  return (
    <li className="flex gap-2">
      <span
        className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}
