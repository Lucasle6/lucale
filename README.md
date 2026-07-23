# Bodegón de José

E-commerce fullstack construido de cero. Proyecto de graduación.

**Stack** — Next.js 15 · React 19 · TypeScript · Fastify 5 · PostgreSQL 17 · Prisma ·
Stripe · Tailwind v4

**Estado** — Semana 0: planificación completa. El Día 1 arranca el código.

---

## Documentación

| Documento | Contenido |
|---|---|
| [Plan maestro](docs/00-plan-maestro.md) | 15 módulos, 3 semanas, ~100 h |
| [Arquitectura](docs/01-arquitectura.md) | Decisiones técnicas y sus trade-offs |
| [Modelo de datos](docs/02-modelo-de-datos.md) | Esquema PostgreSQL |
| [Seguridad](docs/03-seguridad.md) | 20 controles + checklist de auditoría |
| [Design system](docs/04-design-system.md) | Paleta, tipografía y componentes |

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

_Disponible al terminar el Día 1._

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Requisitos previos

| Requisito | Estado |
|---|---|
| Node ≥ 22 (aquí: v26.5.0) | ✅ |
| pnpm ≥ 9 (aquí: 9.15.9) | ✅ |
| Docker (aquí: 29.6.1) | ✅ |
| Cuenta de Stripe en modo test | ⬜ **crear en la Semana 1** |
| Dominio registrado | ⬜ **comprar en la Semana 1** (el DNS tarda) |
| Cuenta de Resend | ⬜ Semana 3 |
| Cuenta de Cloudflare R2 | ⬜ Semana 2 |
