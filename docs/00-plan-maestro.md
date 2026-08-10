# Plan maestro — Bodegón de José

E-commerce fullstack construido de cero. 3 semanas, 15 días hábiles, ~100 horas.

**Escala objetivo:** ~1.000 usuarios/mes. Es carga baja a propósito: nos deja gastar el
esfuerzo en _hacer las cosas bien_ en vez de en escalar. Todas las decisiones asumen que
el cuello de botella es tu aprendizaje, no el servidor.

**Producto inicial:** impresiones 3D. Modelado de forma genérica —`nombre`, `precio`,
`tamaño`— para poder cambiar de rubro sin tocar el esquema.

---

## Cómo leer este plan

Cada día es un **módulo cerrado**: entra con un objetivo, sale con algo que funciona y se
puede demostrar. Nada de "esto lo terminamos mañana". Si un día se cae, el siguiente sigue
funcionando.

Cada módulo tiene tres partes:

- **Construimos** — el entregable concreto.
- **Aprendes** — el concepto que te llevas, el que vas a tener que defender.
- **Demo** — cómo compruebas tú mismo que quedó listo.

Ritmo asumido: **6–7 h/día, 5 días/semana**. Si tu ritmo es otro, los módulos siguen
siendo la unidad; solo cambia el calendario.

---

## Semana 1 — Cimientos: infraestructura, datos y autenticación

**Meta de la semana:** un admin puede registrarse, entrar con 2FA, y la API tiene usuarios
y roles blindados. Sin interfaz todavía — todo se prueba con la API.

Es la semana menos vistosa y la más importante. Todo lo demás se apoya aquí.

### Día 1 · Módulo 0 — Fundaciones (6 h)

**Construimos**

- Monorepo con pnpm workspaces: `apps/web`, `apps/admin`, `apps/api`, `packages/db`,
  `packages/shared`, `packages/ui`
- TypeScript en modo `strict` con configuración compartida
- ESLint + Prettier + husky + lint-staged (nada entra sin pasar el lint)
- `docker-compose` con PostgreSQL 17 + Adminer
- Variables de entorno validadas con Zod: si falta una, la app **no arranca**

**Aprendes**
Por qué un monorepo con tipos compartidos elimina una clase entera de bugs: el frontend y
el backend no pueden desincronizarse si ambos importan el mismo contrato. Y por qué
validar el entorno al arrancar (_fail fast_) es mejor que descubrir a las 3 a.m. que
`STRIPE_SECRET_KEY` estaba vacía.

**Demo:** `pnpm dev` levanta todo; borrar una variable del `.env` rompe el arranque con un
mensaje claro.

### Día 2 · Módulo 1 — Modelo de datos (6 h)

**Construimos**

- Esquema Prisma completo (ver [`02-modelo-de-datos.md`](./02-modelo-de-datos.md))
- Migraciones versionadas e índices deliberados (slug, email, sku, orderNumber)
- Seed con ~12 productos de impresión 3D de ejemplo

**Aprendes**
Tres decisiones que separan un esquema de juguete de uno real:

1. **Dinero en centavos enteros**, nunca `float`. `0.1 + 0.2 !== 0.3` y en dinero eso es
   un descuadre contable.
2. **Snapshots en las órdenes.** Si guardas solo `productId`, cambiar el precio mañana
   reescribe la historia de las ventas de ayer. La orden guarda copia del nombre, tamaño
   y precio del momento de la compra.
3. **Soft deletes.** Un producto vendido no se borra jamás; se archiva.

**Demo:** Adminer muestra las tablas pobladas y las relaciones.

### Día 3 · Módulo 2 — Esqueleto de la API (6 h)

**Construimos**

- Fastify 5 + TypeScript por capas: `routes → controllers → services → repositories`
- Validación con Zod en toda entrada, vía type provider
- Manejo de errores centralizado (el cliente nunca ve un stack trace)
- Logger `pino` con redacción de datos sensibles
- Helmet, CORS con allowlist, rate limiting, compresión
- OpenAPI autogenerado + primer test con Vitest

**Aprendes**
Por qué el controller nunca toca la base de datos. Cuando la lógica de negocio vive en
`services` y el acceso a datos en `repositories`, puedes testear las reglas sin levantar
Postgres, y cambiar de ORM sin reescribir la app.

**Demo:** `GET /health` responde; `/docs` muestra la API documentada sola.

### Día 4 · Módulo 3 — Autenticación de clientes (7 h)

**Construimos**

- Registro y login con hashing **argon2id** (parámetros OWASP)
- Verificación de email por token de un solo uso
- JWT de acceso corto (15 min) + **refresh token rotativo con detección de reuso**
- Cookies `__Host-`, `httpOnly`, `Secure`, `SameSite=Strict`
- Rate limit dedicado al login + defensa contra enumeración de usuarios
- Recuperación de contraseña

**Aprendes**
El módulo donde más seguridad real vas a aprender. En particular la **detección de reuso**:
si un refresh token ya rotado se vuelve a usar, significa que alguien lo robó — así que se
revoca la familia entera de sesiones. Y por qué "email no encontrado" vs "contraseña
incorrecta" le regala a un atacante la lista de tus clientes.

**Demo:** flujo completo por API; robar un token y reusarlo mata la sesión.

### Día 5 · Módulo 4 — Autenticación de admin aislada + RBAC (7 h)

**Construimos**

- Endpoints `/admin/auth/*` totalmente separados, con **audiencia de token distinta**
- **2FA TOTP obligatorio** para admins: secreto, QR, códigos de respaldo
- Guard de roles (`CUSTOMER` / `ADMIN` / `SUPER_ADMIN`)
- Audit log: cada acción administrativa deja rastro (quién, qué, cuándo, desde qué IP)
- Tests de autorización: un `CUSTOMER` no puede tocar nada de admin, ni por accidente

**Aprendes**
Por qué la autorización vive en el servidor y **nunca** en el frontend. Ocultar un botón
no es seguridad: es decoración. Y por qué un token de cliente jamás debe poder abrir una
puerta de admin, aunque el algoritmo de firma sea el mismo.

**Demo:** un token de cliente contra un endpoint de admin devuelve 403, y queda en el log.

---

## Semana 2 — Producto visible: catálogo, dashboard y tienda

**Meta de la semana:** puedes crear un producto desde el dashboard y verlo publicado en la
tienda, con carrito funcionando.

Aquí el proyecto deja de ser abstracto.

### Día 6 · Módulo 5 — Design system (6 h)

**Construimos**

- Next.js 15 (App Router) en `apps/web`, Tailwind v4
- Tokens de la paleta crema/pastel (ver [`04-design-system.md`](./04-design-system.md))
- `packages/ui`: Button, Input, Select, Card, Badge, Dialog, Toast, Skeleton — accesibles,
  con foco visible, escritos por nosotros
- Página `/design-system` para revisar todo junto
- Header con el CTA de cuenta como **«Anmelden/Registrieren»** (ver
  [`04-design-system.md`](./04-design-system.md#textos-de-interfaz))

**Aprendes**
Tokens vs. valores hardcodeados: cambiar la marca entera debe ser editar un archivo, no
buscar 200 hex sueltos. Y a verificar contraste WCAG AA — una paleta pastel es
preciosa y peligrosamente fácil de volver ilegible.

**Demo:** `/design-system` muestra cada componente en todos sus estados.

### Día 7 · Módulo 6 — CRUD de productos + subida de imágenes (7 h)

**Construimos**

- Endpoints de admin: productos, variantes, categorías
- Paginación por cursor, búsqueda y filtros
- Subida de imágenes con presigned URLs, validación de **magic bytes**, límite de tamaño

**Aprendes**
Por qué nunca confías en el `Content-Type` ni en la extensión que manda el cliente: un
`.png` puede ser un script. Se valida leyendo los primeros bytes reales del archivo. Y por
qué la paginación por cursor no se rompe cuando insertas filas mientras el usuario navega.

**Demo:** crear un producto por API y subirle 3 imágenes; intentar subir un `.exe`
renombrado a `.png` falla.

### Día 8 · Módulo 7 — Dashboard de administrador (7 h)

**Construimos**

- `apps/admin`: **aplicación Next.js independiente**, en subdominio propio, `noindex`,
  sin un solo enlace desde la tienda
- Login admin con 2FA + layout del dashboard
- Tabla de productos, formulario crear/editar (react-hook-form + el mismo esquema Zod del
  backend), subida con preview, gestión de stock

**Aprendes**
Por qué separar el admin en su **propia app** y no en una ruta de la tienda: el código del
dashboard nunca se le envía al navegador de un cliente. No hay nada que descubrir mirando
el bundle. Es exactamente lo que pediste, y es un buen argumento de defensa.

**Demo:** creas un producto desde la interfaz y aparece en la base de datos.

### Día 9 · Módulo 8 — Tienda pública (7 h)

**Construimos**

- Home, listado con filtros (categoría, tamaño, precio), ficha de producto con galería y
  selector de tamaño
- SSR/ISR para SEO: metadatos, sitemap, JSON-LD de producto
- Estados de carga y vacíos bien resueltos

**Aprendes**
La diferencia real entre Server y Client Components, y cuándo cada uno. Es el tema donde
más gente se traba con Next.js moderno y el que más se pregunta en entrevistas.

**Demo:** el producto del Día 8 se ve publicado, con buen puntaje de Lighthouse.

### Día 10 · Módulo 9 — Carrito y cuenta de usuario (7 h)

**Construimos**

- Carrito persistente: invitado en cookie firmada, usuario en base de datos, con fusión al
  iniciar sesión
- Validación de stock y **recálculo de totales siempre en el servidor**
- Cuenta: perfil, direcciones, historial de pedidos

**Aprendes**
La regla que más dinero salva: **el precio jamás viaja desde el cliente**. El navegador
manda IDs y cantidades; el servidor busca los precios en la base de datos y calcula el
total. Si confías en el cliente, alguien va a comprar tu catálogo a $0.01.

**Demo:** manipular el precio en el request no cambia el total.

---

## Semana 3 — Cerrar el círculo: pagos, calidad y despliegue

**Meta de la semana:** una compra real de punta a punta, sobre infraestructura desplegada,
con tests y monitoreo.

### Día 11 · Módulo 10 — Checkout con Stripe (7 h)

**Construimos**

- Stripe Checkout Session creada en el servidor, con importes recalculados desde la DB
- Envío, impuestos y moneda MXN
- Páginas de éxito y cancelación

**Aprendes**
Por qué usamos Checkout hospedado: los datos de tarjeta **nunca tocan nuestro servidor**,
lo que nos deja en el alcance PCI más liviano (SAQ-A). Almacenar tarjetas tú mismo es un
proyecto de cumplimiento normativo, no una feature.

**Demo:** compra completa con tarjeta de prueba `4242 4242 4242 4242`.

### Día 12 · Módulo 11 — Webhooks y ciclo de vida de la orden (7 h)

**Construimos**

- Verificación de firma del webhook + **idempotencia** con tabla `WebhookEvent`
- Máquina de estados: `PENDING → PAID → FULFILLED → …`
- Decremento de stock dentro de una transacción
- Reembolsos desde el admin + emails transaccionales (Resend)

**Aprendes**
Que el webhook es la **única fuente de verdad** del pago, no el redirect del navegador. El
usuario puede cerrar la pestaña justo después de pagar, o falsificar la URL de éxito.
También: por qué Stripe reenvía eventos y por qué procesar dos veces el mismo evento
duplicaría la orden si no eres idempotente.

**Demo:** con el CLI de Stripe reenvías el mismo evento 3 veces; la orden sigue siendo una.

### Día 13 · Módulo 12 — Endurecimiento de seguridad (6 h)

**Construimos**

- CSP estricta con nonces, CSRF double-submit, set completo de cabeceras
- Auditoría propia con el checklist OWASP Top 10 de
  [`03-seguridad.md`](./03-seguridad.md)
- Pruebas de intrusión manuales: IDOR, escalada de privilegios, fuerza bruta

**Aprendes**
A pensar como atacante frente a tu propio código. Concretamente **IDOR**: si
`/api/orders/123` no verifica que la orden 123 es tuya, cualquiera lee las compras de
todos cambiando un número. Es la vulnerabilidad más común y más fácil de introducir.

**Demo:** intentas romper tu propia app siguiendo el checklist y documentas el resultado.

### Día 14 · Módulo 13 — Calidad y observabilidad (7 h)

**Construimos**

- Tests unitarios (Vitest), de integración de API, y E2E del flujo de compra (Playwright)
- CI en GitHub Actions: lint + typecheck + tests + build en cada push
- Sentry para errores, logs estructurados, métricas básicas

**Aprendes**
Qué vale la pena testear. No se persigue 100% de cobertura: se cubren los caminos donde un
fallo cuesta dinero — cálculo de totales, autorización, webhooks.

**Demo:** el pipeline pasa en verde y un test E2E completa una compra sin intervención.

### Día 15 · Módulo 14 — Despliegue y entrega (7 h)

**Construimos**

- Neon (Postgres), Vercel (web + admin), Railway (API), Cloudflare R2 (imágenes)
- Dominios separados para tienda y admin, TLS, secretos de producción
- Backups automáticos y runbook de operación
- **README de defensa**: diagramas de arquitectura, decisiones y sus trade-offs

**Aprendes**
Que "funciona en mi máquina" no es un entregable. Y a explicar _por qué_ elegiste cada
cosa — que es lo que realmente se evalúa en una defensa.

**Demo:** un enlace público donde alguien más puede comprar.

---

## Resumen de esfuerzo

| Semana | Foco                            |   Horas | Módulos        |
| ------ | ------------------------------- | ------: | -------------- |
| 1      | Cimientos, datos, autenticación |      32 | 0 – 4          |
| 2      | Catálogo, dashboard, tienda     |      34 | 5 – 9          |
| 3      | Pagos, calidad, despliegue      |      34 | 10 – 14        |
|        | **Total**                       | **100** | **15 módulos** |

---

## Fuera de alcance (deliberadamente)

Se dejan fuera para que las 3 semanas sean alcanzables. Cada una es una extensión natural
después de la entrega:

- Multi-idioma / multi-moneda
- Cupones y descuentos
- Reseñas y valoraciones
- Recomendaciones o búsqueda semántica
- App móvil
- Multi-vendedor (marketplace)
- Integración con transportistas para envíos en tiempo real

---

## Riesgos identificados

| Riesgo                         | Impacto                   | Mitigación                                                  |
| ------------------------------ | ------------------------- | ----------------------------------------------------------- |
| El Día 4–5 (auth) se alarga    | Arrastra toda la semana 2 | Es el módulo más denso; hay holgura en el Día 6             |
| Cuenta de Stripe sin verificar | Bloquea el Día 11         | **Crear la cuenta en modo test el Día 1**, no el Día 11     |
| Dominio no comprado a tiempo   | Bloquea el Día 15         | Comprar en la Semana 1; la propagación DNS tarda            |
| Alcance que crece solo         | Nada queda terminado      | La lista de "fuera de alcance" es un contrato contigo mismo |
