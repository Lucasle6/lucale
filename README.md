# Bodegón de José

E-commerce fullstack construido de cero. Proyecto de graduación.

**Stack** — Next.js 15 · React 19 · TypeScript · Fastify 5 · PostgreSQL 17 · Prisma ·
Stripe · Tailwind v4

**Estado** — Días 1–7 completados: monorepo y toolchain, 15 tablas con catálogo sembrado,
API por capas con defensas HTTP, autenticación con 2FA, panel aislado con RBAC y auditoría,
design system verificado contra WCAG, y CRUD de catálogo con subida de imágenes validada
por contenido. 121 tests en verde. Siguiente: Día 8 — dashboard de administración.

---

## Documentación

| Documento                                     | Contenido                             |
| --------------------------------------------- | ------------------------------------- |
| [Plan maestro](docs/00-plan-maestro.md)       | 15 módulos, 3 semanas, ~100 h         |
| [Arquitectura](docs/01-arquitectura.md)       | Decisiones técnicas y sus trade-offs  |
| [Modelo de datos](docs/02-modelo-de-datos.md) | Esquema PostgreSQL                    |
| [Seguridad](docs/03-seguridad.md)             | 20 controles + checklist de auditoría |
| [Design system](docs/04-design-system.md)     | Paleta, tipografía y componentes      |

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

### Comandos

| Comando           | Qué hace                                                |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | Compila los packages y arranca la API en modo watch     |
| `pnpm dev:web`    | Arranca la tienda (Next.js) en el puerto 3000           |
| `pnpm typecheck`  | TypeScript en todos los workspaces                      |
| `pnpm lint`       | ESLint con reglas que usan información de tipos         |
| `pnpm format`     | Prettier sobre todo el repo                             |
| `pnpm db:up`      | Levanta PostgreSQL 17 + Adminer                         |
| `pnpm db:down`    | Los detiene (conserva los datos)                        |
| `pnpm db:reset`   | Los detiene **borrando el volumen** y vuelve a crearlos |
| `pnpm db:logs`    | Sigue los logs de PostgreSQL                            |
| `pnpm db:migrate` | Crea y aplica migraciones desde el esquema Prisma       |
| `pnpm db:seed`    | Siembra el catálogo de ejemplo (idempotente)            |
| `pnpm db:studio`  | Abre Prisma Studio, un visor de la base de datos        |

### Calidad automática

Cada commit dispara dos hooks de husky:

- **pre-commit** — `lint-staged` pasa ESLint y Prettier solo sobre los archivos
  que estás confirmando.
- **commit-msg** — `commitlint` exige commits convencionales:
  `tipo(ámbito): descripción`, con el ámbito dentro de la lista de
  `commitlint.config.mjs`.

## Requisitos previos

| Requisito                     | Estado                                       |
| ----------------------------- | -------------------------------------------- |
| Node ≥ 22 (aquí: v26.5.0)     | ✅                                           |
| pnpm ≥ 9 (aquí: 9.15.9)       | ✅                                           |
| Docker (aquí: 29.6.1)         | ✅                                           |
| Cuenta de Stripe en modo test | ⬜ **crear en la Semana 1**                  |
| Dominio registrado            | ⬜ **comprar en la Semana 1** (el DNS tarda) |
| Cuenta de Resend              | ⬜ Semana 3                                  |
| Cuenta de Cloudflare R2       | ⬜ Semana 2                                  |
