# Arquitectura — Bodegón de José

Cada decisión con su porqué y su costo. En una defensa no te preguntan *qué* usaste, te
preguntan *por qué*.

---

## Vista general

```
                    ┌──────────────────────┐
   bodegon.mx  ───► │  apps/web            │  Next.js 15 · tienda pública
                    │  (Vercel)            │  SSR/ISR, SEO, carrito
                    └──────────┬───────────┘
                               │  HTTPS + cookies httpOnly
                    ┌──────────▼───────────┐
                    │  apps/api            │  Fastify 5 · TypeScript
                    │  (Railway)           │  auth · catálogo · órdenes
                    └─────┬──────────┬─────┘
                          │          │
            ┌─────────────▼──┐   ┌───▼──────────────┐
            │ PostgreSQL 17  │   │ Stripe · R2 ·    │
            │ (Neon)         │   │ Resend           │
            └────────────────┘   └──────────────────┘
                               ▲
                    ┌──────────┴───────────┐
 admin.bodegon.mx ► │  apps/admin          │  Next.js 15 · dashboard
                    │  (Vercel, noindex)   │  bundle nunca servido al público
                    └──────────────────────┘
```

## Estructura del monorepo

```
bodegon-de-jose/
├─ apps/
│  ├─ web/          Next.js — tienda pública y cuenta de usuario
│  ├─ admin/        Next.js — dashboard de administración (app separada)
│  └─ api/          Fastify — toda la lógica de negocio
├─ packages/
│  ├─ db/           Prisma: esquema, migraciones, seed, cliente
│  ├─ shared/       tipos + esquemas Zod compartidos (el contrato de la API)
│  └─ ui/           design system: tokens y componentes base
├─ infra/           docker-compose, scripts de operación
└─ docs/            este directorio
```

---

## Decisiones y trade-offs

### Monorepo con pnpm workspaces

**Por qué.** Los esquemas Zod de `packages/shared` los importan la API *y* los formularios
del frontend. Un cambio de contrato rompe la compilación de ambos lados al instante, en vez
de fallar en producción.

**Costo.** Configuración inicial algo más compleja y builds que hay que orquestar.

**Alternativa descartada.** Repos separados con un paquete npm de tipos: más ceremonia para
publicar versiones y más ventanas de desincronización.

### Fastify en lugar de Express

**Por qué.** Validación de esquemas y serialización integradas (2–3× más rápido en
throughput), soporte de TypeScript nativo, sistema de plugins con encapsulación real. El
ecosistema oficial (`@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`) es
mantenido por el mismo equipo.

**Costo.** Menos tutoriales que Express y algunas librerías de terceros asumen Express.

**Alternativa descartada.** NestJS: excelente, pero para 1.000 usuarios/mes su estructura
de decoradores e inyección de dependencias añade curva sin resolver un problema que
tengamos.

### API separada, no Route Handlers de Next.js

**Por qué.** La lógica de negocio queda independiente del framework de UI. Puedes probar
la API sola, versionarla, y mañana consumirla desde una app móvil sin reescribir nada. Y
es lo que hace defendible la palabra "fullstack" en el título.

**Costo.** Dos despliegues, CORS que configurar, y no puedes usar Server Actions para
mutaciones directas a la DB.

### `apps/admin` como aplicación independiente

**Por qué.** Este es tu requisito de que los clientes no vean *nada* del dashboard, llevado
a su conclusión lógica. En un solo Next.js, aunque protejas las rutas, el JavaScript del
admin puede terminar en el bundle público y las rutas son descubribles. Como app separada
en otro subdominio, **el código simplemente no existe** para el navegador de un cliente.

Encima permite endurecerlo por separado: `noindex`, CSP más estricta, y opcionalmente una
allowlist de IPs — sin afectar a la tienda.

**Costo.** Un despliegue más y algo de duplicación de layout (mitigada por `packages/ui`).

### PostgreSQL, no NoSQL

**Por qué.** Un e-commerce es relacional de manual: una orden referencia variantes, que
pertenecen a productos, que pertenecen a categorías. Y sobre todo necesitamos
**transacciones ACID**: cobrar y decrementar stock deben ocurrir juntos o no ocurrir. En
Mongo eso se resuelve con esfuerzo; en Postgres es `BEGIN`.

Además hay que hacer consultas que el equipo no anticipó ("ventas por tamaño en marzo"),
y para eso SQL es imbatible.

**Costo.** Esquema rígido; cada cambio requiere una migración. En este dominio eso es una
ventaja disfrazada.

**Alternativa descartada.** MongoDB: encaja bien con catálogos de atributos variables, pero
pagaríamos con integridad transaccional justo donde está el dinero.

### Prisma como capa de datos

**Por qué.** Tipos generados desde el esquema (el autocompletado conoce tus tablas),
migraciones versionadas en git, y **consultas parametrizadas por defecto** — SQL injection
deja de ser algo que puedas introducir por descuido.

**Costo.** Una capa de abstracción entre tú y SQL, y consultas muy complejas a veces piden
`$queryRaw`. Cuando pase, lo escribimos en SQL a mano y aprendes las dos cosas.

### Autenticación propia (no Auth0 / Clerk / NextAuth)

**Por qué.** Es la mitad del valor formativo del proyecto, y el requisito de admin aislado
con 2FA obligatorio y audiencias de token separadas es más limpio de implementar que de
configurar en un proveedor.

**Costo.** La autenticación es donde más caro sale equivocarse. Lo compensamos siguiendo
las guías OWASP al pie de la letra — ver [`03-seguridad.md`](./03-seguridad.md).

**Nota honesta.** En un producto comercial con equipo pequeño, delegar auth a un proveedor
suele ser la decisión correcta. Aquí el objetivo es aprender, y eso cambia el cálculo. Vale
la pena decirlo así en la defensa: demuestra criterio, no dogma.

### Stripe Checkout hospedado

**Por qué.** Los datos de tarjeta nunca tocan nuestro servidor, lo que nos deja en **PCI
DSS SAQ-A**, el nivel de cumplimiento más liviano que existe. Stripe además nos da 3D
Secure, detección de fraude y métodos locales de México (OXXO, SPEI) sin código extra.

**Costo.** Menos control sobre la interfaz de pago; el usuario sale a un dominio de Stripe.

**Ruta de evolución.** Migrar a Stripe Payment Elements (embebido, misma seguridad) cuando
la marca lo pida.

### Resto de servicios

| Necesidad | Elección | Por qué |
|---|---|---|
| Imágenes | Cloudflare R2 | S3-compatible, **sin costo de egreso** — lo que mata a S3 en un catálogo con fotos |
| Email | Resend | 3.000/mes gratis; API moderna y plantillas en React |
| Errores | Sentry | Trazas con source maps; capa gratuita suficiente |
| Base de datos | Neon | Postgres serverless, branching por rama de git, capa gratuita generosa |

Todos están detrás de una interfaz propia (`StorageService`, `MailerService`,
`PaymentProvider`) — si mañana cambias de proveedor, tocas un archivo.

---

## Stack completo

**Frontend** — Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
react-hook-form + Zod · TanStack Query (estado de servidor en el admin)

**Backend** — Node 22+ · Fastify 5 · TypeScript · Zod · Prisma 6 · argon2 · otplib (TOTP) ·
pino

**Datos** — PostgreSQL 17 · Redis (rate limiting distribuido, solo en producción)

**Calidad** — Vitest · Playwright · ESLint · Prettier · GitHub Actions

---

## Por qué esta arquitectura aguanta 1.000 usuarios/mes con holgura

1.000 usuarios/mes son ~33/día: en el pico realista, **menos de 1 request por segundo**.
Una sola instancia de Fastify maneja del orden de miles. Es decir, estamos
sobredimensionados por dos o tres órdenes de magnitud — y eso es intencional.

El objetivo no es exprimir el hardware, es que la **arquitectura sea correcta**. La misma
estructura por capas, con Redis para caché y varias instancias de API detrás de un balanceador,
sostiene 100.000 usuarios/mes sin reescribir nada. Escalar sería cambiar números de
configuración, no código.
