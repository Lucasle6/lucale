# Design system — Bodegón de José

Paleta sobria de blancos, cremas y pasteles. Delicada sin volverse frágil, profesional sin
volverse fría.

Todos los ratios de contraste de este documento están **calculados con la fórmula WCAG
2.1**, no estimados a ojo. El riesgo real de una paleta pastel es quedar preciosa e
ilegible; dos colores se oscurecieron respecto al primer borrador por ese motivo.

---

## Principio rector

El color no es la marca aquí — **el espacio en blanco lo es**. La paleta se mantiene
apagada a propósito para que el producto (una impresión 3D, una fotografía) sea lo único
saturado en pantalla. El acento terracota aparece poco, y por eso pesa.

Tres reglas que se aplican sin excepción:

1. **Nunca negro puro ni blanco puro** como texto o fondo principal. `#2B2521` sobre
   `#FDFBF7` — ambos con temperatura cálida. El negro puro sobre blanco puro vibra y cansa.
2. **Nunca un color saturado a pantalla completa.** Los pasteles son fondos de detalle
   (badges, estados), jamás secciones enteras.
3. **El foco siempre visible.** Anillo de 2 px en `brand-700` con 2 px de separación. Una
   interfaz delicada que no se puede navegar con teclado no es elegante, es excluyente.

---

## Neutrales cálidos — la base

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--bg` | `#FDFBF7` | Fondo de página (blanco hueso) | — |
| `--surface` | `#F8F4ED` | Tarjetas, secciones alternas (crema) | — |
| `--surface-raised` | `#FFFFFF` | Modales, elementos elevados | — |
| `--border-subtle` | `#E2DACD` | Separadores decorativos | 1.34:1 · solo decorativo |
| `--border-strong` | `#9C8E76` | Bordes de inputs y controles | **3.10:1** ✓ UI |
| `--text-primary` | `#2B2521` | Texto principal | **14.62:1** ✓ AAA |
| `--text-secondary` | `#4A423A` | Texto de apoyo | **9.53:1** ✓ AAA |
| `--text-muted` | `#756B60` | Metadatos, placeholders | **5.04:1** ✓ AA |

> `--border-subtle` no llega a 3:1 a propósito: es una línea decorativa. Todo borde que
> delimite un **control interactivo** (input, select, checkbox) usa `--border-strong`, que
> sí cumple el criterio WCAG 1.4.11 de contraste de componentes.

## Marca — terracota / arcilla

Un tono de barro cocido. Encaja con impresión 3D sin ser literal, y envejece mejor que
cualquier acento de moda.

| Token | Hex | Uso |
|---|---|---|
| `--brand-50` | `#FAF4F0` | Fondo de estado hover muy sutil |
| `--brand-100` | `#F2E5DC` | Fondo de badge, chip seleccionado |
| `--brand-200` | `#E4CCBC` | Bordes de acento |
| `--brand-300` | `#D3B09B` | Elementos decorativos |
| `--brand-400` | `#BF917A` | Iconografía sobre fondo oscuro |
| `--brand-500` | `#A87560` | Solo UI y texto grande — 3.90:1 con blanco |
| `--brand-600` | `#8C5E4B` | **Botón primario** — 5.50:1 con blanco ✓ |
| `--brand-700` | `#714B3C` | Hover, anillo de foco, enlaces — 7.57:1 ✓ |
| `--brand-800` | `#573A2E` | Estado activo/pulsado |
| `--brand-900` | `#3E2A21` | Base de las sombras |

> Nota de implementación: `brand-500` es el color que "se ve" como la marca, pero **no
> alcanza para texto blanco encima**. El botón primario usa `brand-600`. Es exactamente el
> tipo de error que se cuela cuando se elige la paleta a ojo.

## Acento secundario — salvia

| Token | Hex | Uso |
|---|---|---|
| `--sage-300` | `#7E9686` | Detalles decorativos — 3.08:1 |
| `--sage-700` | `#55705F` | Texto o fondo con blanco — 5.43:1 ✓ |

## Pasteles de apoyo

Solo como **fondo** de elementos pequeños, siempre con `--text-primary` encima.

`--pastel-mauve #E3D7E0` · `--pastel-blue #D3DEE6` · `--pastel-peach #F2DCCF`

## Semánticos

| Token | Hex | Texto encima | Contraste |
|---|---|---|---|
| `--success` | `#4E7A61` | blanco | **4.91:1** ✓ |
| `--warning` | `#E8C87E` | `--text-primary` | **9.35:1** ✓ |
| `--danger` | `#A85B52` | blanco | **4.90:1** ✓ |

Los tres están desaturados a propósito: un rojo de alarma clásico rompería la sobriedad del
conjunto. Siguen siendo inequívocos, y nunca son el único indicador — siempre acompañados
de icono y texto, para no depender del color (WCAG 1.4.1).

---

## Tipografía

**Títulos — Fraunces** (variable serif). Cálida, con carácter artesanal, y a la vez seria.
Es lo que le da el aire de "bodegón" sin caer en lo rústico.

**Interfaz y cuerpo — Inter**. Neutra, altísima legibilidad en tamaños pequeños, excelente
para tablas del dashboard.

Ambas se cargan con `next/font` — **auto-hospedadas**, sin request a Google. Además de ser
más rápido, evita tener que abrir la CSP a un dominio externo.

| Escala | Tamaño / interlineado | Uso |
|---|---|---|
| `xs` | 12 / 16 | Etiquetas, ayudas |
| `sm` | 14 / 20 | Texto secundario, tablas |
| `base` | 16 / 26 | Cuerpo |
| `lg` | 18 / 28 | Entradilla |
| `xl` | 20 / 30 | Título de tarjeta |
| `2xl` | 25 / 34 | Título de sección |
| `3xl` | 31 / 40 | Título de página |
| `4xl` | 39 / 48 | Hero secundario |
| `5xl` | 49 / 56 | Hero (Fraunces) |

Longitud de línea máxima **68 caracteres** en texto corrido.

## Espaciado, radios y sombras

**Espaciado** — base 4 px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.
Generoso por defecto: en esta paleta, el aire *es* el diseño.

**Radios** — `sm 4` · `md 8` · `lg 12` · `xl 16` · `full 9999`.
Suave sin ser infantil. Botones e inputs en `md`, tarjetas en `lg`.

**Sombras** — tintadas en `brand-900`, nunca en negro puro. Una sombra gris sobre un fondo
crema se ve sucia.

```css
--shadow-sm: 0 1px 2px  rgba(62, 42, 33, 0.05);
--shadow-md: 0 4px 12px rgba(62, 42, 33, 0.06);
--shadow-lg: 0 12px 32px rgba(62, 42, 33, 0.08);
```

---

## Componentes del Día 6

Se construyen en `packages/ui`, con todos sus estados (`default · hover · focus · active ·
disabled · loading · error`):

`Button` (primary / secondary / ghost / danger) · `Input` · `Textarea` · `Select` ·
`Checkbox` · `Radio` · `Card` · `Badge` · `Dialog` · `Toast` · `Skeleton` · `Table` ·
`Pagination` · `EmptyState`

Todos con navegación por teclado, roles ARIA correctos y foco visible. La página
`/design-system` los muestra juntos para revisarlos de un vistazo — y para detectar
inconsistencias antes de que se propaguen.

---

## Fuera de alcance

**Modo oscuro.** Duplica el trabajo de tokens y de QA visual, y en 3 semanas ese tiempo
rinde más en pagos y seguridad. Los tokens están declarados como variables CSS bajo
`:root`, así que añadirlo después es escribir un bloque `[data-theme="dark"]` — no
refactorizar la aplicación.
