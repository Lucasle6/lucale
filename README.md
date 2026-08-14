# LuCaLe

E-commerce fullstack construido de cero. Proyecto de graduación.

**Stack** — Next.js 16 · React 19 · TypeScript · Fastify 5 · PostgreSQL 17 · Prisma 6 ·
Stripe · Tailwind v4

**Estado** — **Los 15 días completos.** Una compra funciona de punta a punta: catálogo →
carrito → checkout → Stripe → webhook firmado → pedido pagado → inventario descontado.

**198 pruebas** en verde: 172 de la API, 19 de la aritmética de dinero y 7 recorridos en
un navegador real. Integración continua, auditoría de dependencias y 21 controles de
seguridad verificados en vivo contra el servidor, no leyendo código.

Falta el paso que no depende del código: desplegarlo. El procedimiento está en
[docs/05-despliegue.md](docs/05-despliegue.md).

---

## Documentación

| Documento                                     | Contenido                             |
| --------------------------------------------- | ------------------------------------- |
| [Plan maestro](docs/00-plan-maestro.md)       | 15 módulos, 3 semanas, ~100 h         |
| [Arquitectura](docs/01-arquitectura.md)       | Decisiones técnicas y sus trade-offs  |
| [Modelo de datos](docs/02-modelo-de-datos.md) | Esquema PostgreSQL                    |
| [Seguridad](docs/03-seguridad.md)             | 20 controles + checklist de auditoría |
| [Design system](docs/04-design-system.md)     | Paleta, tipografía y componentes      |
| [Despliegue](docs/05-despliegue.md)           | Runbook de producción y operación     |

## Estructura

```
apps/web       tienda pública          Next.js
apps/admin     dashboard (aislado)     Next.js · subdominio separado
apps/api       lógica de negocio       Fastify
packages/db    Prisma: esquema y migraciones
packages/shared  contratos Zod compartidos
packages/ui    design system
infra/         docker-compose y scripts
```

## Puesta en marcha

```bash
pnpm install && cp .env.example .env && pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev
```

La API queda en http://localhost:4000 (prueba `/health`) y Adminer en
http://localhost:8080 para inspeccionar la base de datos (servidor `postgres`,
usuario y contraseña según tu `.env`).

Para la tienda, en otra terminal:

```bash
pnpm dev:web
```

Queda en http://localhost:3000, y el escaparate del design system en
http://localhost:3000/design-system.

El panel de administración va aparte, en su propio puerto:

```bash
pnpm dev:admin
```

Queda en http://localhost:3001. Es una aplicación **independiente**: su código
nunca llega al navegador de un cliente de la tienda.

### Comandos

| Comando              | Qué hace                                                |
| -------------------- | ------------------------------------------------------- |
| `pnpm dev`           | Compila los packages y arranca la API en modo watch     |
| `pnpm dev:web`       | Arranca la tienda (Next.js) en el puerto 3000           |
| `pnpm dev:admin`     | Arranca el panel de administración en el puerto 3001    |
| `pnpm typecheck`     | TypeScript en todos los workspaces                      |
| `pnpm lint`          | ESLint con reglas que usan información de tipos         |
| `pnpm format`        | Prettier sobre todo el repo                             |
| `pnpm db:up`         | Levanta PostgreSQL 17 + Adminer                         |
| `pnpm db:down`       | Los detiene (conserva los datos)                        |
| `pnpm db:reset`      | Los detiene **borrando el volumen** y vuelve a crearlos |
| `pnpm db:logs`       | Sigue los logs de PostgreSQL                            |
| `pnpm db:migrate`    | Crea y aplica migraciones desde el esquema Prisma       |
| `pnpm db:seed`       | Siembra el catálogo de ejemplo (idempotente)            |
| `pnpm db:studio`     | Abre Prisma Studio, un visor de la base de datos        |
| `pnpm test`          | Las 191 pruebas de API y aritmética de dinero           |
| `pnpm test:e2e`      | Los 7 recorridos de compra en un navegador real         |
| `pnpm db:test:setup` | Crea, migra y siembra la base de datos de PRUEBAS       |
| `pnpm secretos`      | Genera los secretos de producción (no escribe nada)     |

Las pruebas de navegador van aparte porque levantan la API y la tienda en
puertos propios. La primera vez hay que descargar Chromium:

```bash
pnpm --filter @bodegon/e2e install:browsers
```

### Calidad automática

Cada commit dispara dos hooks de husky:

- **pre-commit** — `lint-staged` pasa ESLint y Prettier solo sobre los archivos
  que estás confirmando.
- **commit-msg** — `commitlint` exige commits convencionales:
  `tipo(ámbito): descripción`, con el ámbito dentro de la lista de
  `commitlint.config.mjs`.

## Requisitos previos

| Requisito                     | Estado                                     |
| ----------------------------- | ------------------------------------------ |
| Node ≥ 22 (aquí: v26.5.0)     | ✅                                         |
| pnpm ≥ 9 (aquí: 9.15.9)       | ✅                                         |
| Docker (aquí: 29.6.1)         | ✅                                         |
| Cuenta de Stripe en modo test | ✅                                         |
| Dominio registrado            | ⬜ opcional: el subdominio de Vercel sirve |
| Cuenta de Resend              | ⬜ los correos hoy se escriben en el log   |
| Cuenta de Cloudflare R2       | ⬜ las imágenes hoy se sirven en local     |

Las tres pendientes no bloquean nada: el proyecto funciona sin ellas, con la
implementación local detrás de la misma interfaz. Cambiarlas es sustituir un
proveedor, no reescribir código.
