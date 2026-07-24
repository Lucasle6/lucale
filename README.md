# Bodegón de José

E-commerce fullstack construido de cero. Proyecto de graduación.

**Stack** — Next.js 15 · React 19 · TypeScript · Fastify 5 · PostgreSQL 17 · Prisma ·
Stripe · Tailwind v4

**Estado** — Días 1–2 completados: monorepo y toolchain; esquema de datos con 15 tablas,
migración aplicada y catálogo de ejemplo sembrado. Siguiente: Día 3 — esqueleto de la API.

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

### Comandos

| Comando           | Qué hace                                                |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | Compila los packages y arranca la API en modo watch     |
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
