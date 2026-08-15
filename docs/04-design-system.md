# Design system — LuCaLe

**Hay dos temas, y la misma paleta sirve para los dos.**

|                          | tema       | por qué                                          |
| ------------------------ | ---------- | ------------------------------------------------ |
| **Tienda** (`apps/web`)  | **oscuro** | el producto es lo único luminoso en pantalla     |
| **Panel** (`apps/admin`) | **claro**  | se leen tablas y se editan precios durante horas |

El tema oscuro no define tokens nuevos: **redefine los mismos** dentro de
`[data-tema="oscuro"]`, que la tienda pone en su `<html>`. Por eso cada `bg-surface` y cada
`text-ink-500` escrito en un componente cambia solo, sin una línea de código condicional. La
fuente única sigue siendo [`packages/ui/src/tokens.css`](../packages/ui/src/tokens.css);
este documento la explica, no la duplica.

Todos los ratios de contraste de este documento están **calculados con la fórmula WCAG
2.1**, no estimados a ojo. El riesgo real de una paleta pastel es quedar preciosa e
ilegible; dos colores se oscurecieron respecto al primer borrador por ese motivo, y en el
tema oscuro un tercero — el borde de controles se quedaba en 2.44:1 y hubo que subirlo.

> **Cómo se miden.** Un color de texto se mide contra el **fondo**; un relleno de botón, contra
> **el texto que lleva encima**. Medir un botón contra la página da un número tranquilizador
> y falso. Por eso cada tabla dice contra qué está medido.

---

## Principio rector

El color no es la marca aquí — **el vacío lo es**. En el panel ese vacío es blanco; en la
tienda es carbón. En los dos casos hace lo mismo: dejar que el producto —un frasco de salsa,
una fotografía— sea lo único saturado en pantalla. El acento aparece poco, y por eso pesa.

Cuatro reglas que se aplican sin excepción:

1. **Nunca negro puro ni blanco puro** como texto o fondo principal. `#2B2521` sobre
   `#FDFBF7` en claro, `#F4EEE4` sobre `#141110` en oscuro — todos con temperatura cálida.
   El negro puro sobre blanco puro vibra y cansa; el negro absoluto bajo una foto se ve plano.
2. **Nunca un color saturado a pantalla completa.** Los pasteles son fondos de detalle
   (badges, estados), jamás secciones enteras.
3. **El foco siempre visible.** Anillo de 2 px en `brand-700` con 2 px de separación. Una
   interfaz delicada que no se puede navegar con teclado no es elegante, es excluyente.
4. **Ningún contraste se estima.** Se calcula, se anota junto al token, y se mide contra el
   color con el que de verdad va emparejado.

---

## Neutrales cálidos — la base

| Token              | Hex       | Uso                                  | Contraste                |
| ------------------ | --------- | ------------------------------------ | ------------------------ |
| `--bg`             | `#FDFBF7` | Fondo de página (blanco hueso)       | —                        |
| `--surface`        | `#F8F4ED` | Tarjetas, secciones alternas (crema) | —                        |
| `--surface-raised` | `#FFFFFF` | Modales, elementos elevados          | —                        |
| `--border-subtle`  | `#E2DACD` | Separadores decorativos              | 1.34:1 · solo decorativo |
| `--border-strong`  | `#9C8E76` | Bordes de inputs y controles         | **3.10:1** ✓ UI          |
| `--text-primary`   | `#2B2521` | Texto principal                      | **14.62:1** ✓ AAA        |
| `--text-secondary` | `#4A423A` | Texto de apoyo                       | **9.53:1** ✓ AAA         |
| `--text-muted`     | `#756B60` | Metadatos, placeholders              | **5.04:1** ✓ AA          |

> `--border-subtle` no llega a 3:1 a propósito: es una línea decorativa. Todo borde que
> delimite un **control interactivo** (input, select, checkbox) usa `--border-strong`, que
> sí cumple el criterio WCAG 1.4.11 de contraste de componentes.

## Marca — terracota / arcilla

Un tono de barro cocido. Encaja con cocina mexicana sin ser literal, y envejece mejor que
cualquier acento de moda.

| Token         | Hex       | Uso                                        |
| ------------- | --------- | ------------------------------------------ |
| `--brand-50`  | `#FAF4F0` | Fondo de estado hover muy sutil            |
| `--brand-100` | `#F2E5DC` | Fondo de badge, chip seleccionado          |
| `--brand-200` | `#E4CCBC` | Bordes de acento                           |
| `--brand-300` | `#D3B09B` | Elementos decorativos                      |
| `--brand-400` | `#BF917A` | Iconografía sobre fondo oscuro             |
| `--brand-500` | `#A87560` | Solo UI y texto grande — 3.90:1 con blanco |
| `--brand-600` | `#8C5E4B` | **Botón primario** — 5.50:1 con blanco ✓   |
| `--brand-700` | `#714B3C` | Hover, anillo de foco, enlaces — 7.57:1 ✓  |
| `--brand-800` | `#573A2E` | Estado activo/pulsado                      |
| `--brand-900` | `#3E2A21` | Base de las sombras                        |

> Nota de implementación: `brand-500` es el color que "se ve" como la marca, pero **no
> alcanza para texto blanco encima**. El botón primario usa `brand-600`. Es exactamente el
> tipo de error que se cuela cuando se elige la paleta a ojo.

## Acento secundario — salvia

| Token        | Hex       | Uso                                 |
| ------------ | --------- | ----------------------------------- |
| `--sage-300` | `#7E9686` | Detalles decorativos — 3.08:1       |
| `--sage-700` | `#55705F` | Texto o fondo con blanco — 5.43:1 ✓ |

## Pasteles de apoyo

Solo como **fondo** de elementos pequeños, siempre con `--text-primary` encima.

`--pastel-mauve #E3D7E0` · `--pastel-blue #D3DEE6` · `--pastel-peach #F2DCCF`

## Semánticos

| Token       | Hex       | Texto encima     | Contraste    |
| ----------- | --------- | ---------------- | ------------ |
| `--success` | `#4E7A61` | blanco           | **4.91:1** ✓ |
| `--warning` | `#E8C87E` | `--text-primary` | **9.35:1** ✓ |
| `--danger`  | `#A85B52` | blanco           | **4.90:1** ✓ |

Los tres están desaturados a propósito: un rojo de alarma clásico rompería la sobriedad del
conjunto. Siguen siendo inequívocos, y nunca son el único indicador — siempre acompañados
de icono y texto, para no depender del color (WCAG 1.4.1).

---

# Tema oscuro — la tienda

Mismos nombres de token, valores distintos. Se activa con `data-tema="oscuro"` en el
`<html>` de la tienda.

## Neutrales — carbón cálido

Nunca negro puro, por la misma razón que en claro nunca hay blanco puro: el negro absoluto
contra texto claro produce un halo que cansa, y bajo la foto de un producto se ve plano.

| Token              | Hex       | Uso                           | Contraste sobre `#141110` |
| ------------------ | --------- | ----------------------------- | ------------------------- |
| `--bg`             | `#141110` | Fondo de página               | —                         |
| `--surface`        | `#1C1816` | Tarjetas y secciones alternas | —                         |
| `--surface-raised` | `#241F1C` | Modales y elementos elevados  | —                         |
| `--border-subtle`  | `#2B2522` | Separadores decorativos       | 1.24:1 · solo decorativo  |
| `--border-strong`  | `#77695D` | Bordes de inputs y controles  | **3.55:1** ✓ UI           |
| `--ink-900`        | `#F4EEE4` | Texto principal               | **16.28:1** ✓ AAA         |
| `--ink-700`        | `#CEC2B2` | Texto de apoyo                | **10.72:1** ✓ AAA         |
| `--ink-500`        | `#9A8C7B` | Metadatos, placeholders       | **5.74:1** ✓ AA           |

> `--border-strong` empezó en `#5C5148` y se quedaba en **2.44:1**, por debajo del mínimo de
> 3:1 que el tema claro ya exigía para controles. Es el error típico de una paleta oscura:
> bajar el contraste porque "se ve más elegante", y dejar el texto secundario ilegible para
> quien mira el móvil al sol.

## Marca — latón

La terracota del tema claro **no sobrevive al carbón**: se apaga y se ensucia. El latón
mantiene el calor pero gana luz, y es lo que separa "elegante" de "rústico".

La escala se **invierte**: en claro los números altos son los oscuros; en oscuro son los
luminosos.

| Token         | Hex       | Uso                                             |
| ------------- | --------- | ----------------------------------------------- |
| `--brand-50`  | `#201A12` | Fondo de hover muy sutil                        |
| `--brand-100` | `#2E2517` | Fondo de badge, chip seleccionado               |
| `--brand-200` | `#453718` | Bordes de acento                                |
| `--brand-300` | `#6B551F` | Elementos decorativos                           |
| `--brand-400` | `#8F7223` | Iconografía — 4.12:1 sobre el fondo             |
| `--brand-500` | `#B08D26` | UI y texto grande — 5.98:1                      |
| `--brand-600` | `#C9A227` | **Botón primario**, con texto oscuro — 7.77:1 ✓ |
| `--brand-700` | `#DCC06A` | Hover, anillo de foco, enlaces — 10.55:1 ✓      |
| `--brand-800` | `#E8D391` | Estado activo/pulsado                           |
| `--brand-900` | `#F2E6BF` | Texto de acento sobre superficies elevadas      |

> **El botón primario cambia de color de texto.** En claro es `brand-600` con texto blanco;
> en oscuro es `brand-600` (latón) con texto **oscuro** encima. Un latón luminoso con letras
> blancas no se lee.

## Semánticos, aclarados

| Token       | Hex       | Contraste sobre `#141110` |
| ----------- | --------- | ------------------------- |
| `--success` | `#7FB495` | **7.93:1** ✓ AAA          |
| `--warning` | `#E8C87E` | **11.63:1** ✓ AAA         |
| `--danger`  | `#E08A80` | **7.26:1** ✓ AAA          |

El `danger` de la paleta clara (`#A85B52`) es un rojo oscuro que sobre carbón desaparece.
Aclarado, sigue leyéndose como alarma sin gritar.

## Lo que cambia de papel

**Los pasteles pierden su función.** Un fondo pastel con texto claro encima no contrasta, así
que en oscuro se convierten en tintes muy apagados para insignias, siempre con `--ink-900`
encima: `#2F2630` · `#222B31` · `#33261F`.

**Las sombras dejan de separar planos.** Una sombra negra sobre carbón es invisible. En
oscuro lo que separa es la **luz**: el trabajo lo hace `--surface-raised`, y las sombras
quedan casi anuladas.

---

# Movimiento

Duraciones y curvas son tokens, no valores sueltos por los componentes. Si cada transición
elige la suya, el sitio se siente descoordinado aunque cada pieza por separado esté bien.

| Token               | Valor                       | Para                           |
| ------------------- | --------------------------- | ------------------------------ |
| `--duracion-rapida` | `150ms`                     | Hover, foco, cambios de estado |
| `--duracion-media`  | `320ms`                     | Entradas y salidas             |
| `--duracion-lenta`  | `600ms`                     | Revelados al hacer scroll      |
| `--curva-salida`    | `cubic-bezier(.22,1,.36,1)` | Decelera al final              |
| `--curva-suave`     | `cubic-bezier(.65,0,.35,1)` | Simétrica, para bucles         |

Las curvas salen despacio y entran rápido: es lo que hace que un movimiento parezca material
en vez de mecánico. Nada usa `linear` salvo lo que gira en bucle.

**El movimiento reducido no se comprueba en cada componente.** `tokens.css` anula las
duraciones de toda animación y transición cuando el sistema lo pide, así que un elemento que
debía entrar deslizándose aparece de golpe, en su sitio. Hay personas a las que las
animaciones les provocan mareo o migraña; no es una preferencia estética.

---

## Tipografía

**Títulos — Fraunces** (variable serif). Cálida, con carácter artesanal, y a la vez seria.
Es lo que le da el aire de "bodegón" sin caer en lo rústico.

**Interfaz y cuerpo — Inter**. Neutra, altísima legibilidad en tamaños pequeños, excelente
para tablas del dashboard.

Ambas se cargan con `next/font` — **auto-hospedadas**, sin request a Google. Además de ser
más rápido, evita tener que abrir la CSP a un dominio externo.

| Escala | Tamaño / interlineado | Uso                      |
| ------ | --------------------- | ------------------------ |
| `xs`   | 12 / 16               | Etiquetas, ayudas        |
| `sm`   | 14 / 20               | Texto secundario, tablas |
| `base` | 16 / 26               | Cuerpo                   |
| `lg`   | 18 / 28               | Entradilla               |
| `xl`   | 20 / 30               | Título de tarjeta        |
| `2xl`  | 25 / 34               | Título de sección        |
| `3xl`  | 31 / 40               | Título de página         |
| `4xl`  | 39 / 48               | Hero secundario          |
| `5xl`  | 49 / 56               | Hero (Fraunces)          |

Longitud de línea máxima **68 caracteres** en texto corrido.

## Textos de interfaz

El punto de entrada a la cuenta se etiqueta **«Anmelden/Registrieren»** (ES: «Iniciar
sesión / Registrarse»), nunca solo «Registrieren».

Al arrancar la app todavía no sabemos qué viene a hacer quien llega: puede tener cuenta o
puede ir a crearla. Un botón que dice solo «Registrieren» le habla a la mitad de los
usuarios y deja a la otra mitad buscando dónde entrar. La barra anuncia las dos acciones y
la pantalla siguiente las separa.

Aplica al header de `apps/web`, a la pantalla de bienvenida y a cualquier CTA que lleve a
`/auth`. **Dentro** del formulario cada botón sí dice lo suyo: «Anmelden» envía el login y
«Registrieren» crea la cuenta — ahí ya no hay ambigüedad que resolver.

> Decisión de la revisión de Marco del 1 de agosto de 2026. De paso: el texto actual del
> prototipo dice «Registrierem», con _m_.

---

## Espaciado, radios y sombras

**Espaciado** — base 4 px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.
Generoso por defecto: en esta paleta, el aire _es_ el diseño.

**Radios** — `sm 4` · `md 8` · `lg 12` · `xl 16` · `full 9999`.
Suave sin ser infantil. Botones e inputs en `md`, tarjetas en `lg`.

**Sombras** — tintadas en `brand-900`, nunca en negro puro. Una sombra gris sobre un fondo
crema se ve sucia.

```css
--shadow-sm: 0 1px 2px rgba(62, 42, 33, 0.05);
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
