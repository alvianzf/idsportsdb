# KONI Batam Web App

Sports management system for KONI Batam (Komite Olahraga Nasional Indonesia,
Batam chapter) — manages sport disciplines (cabang olahraga), athletes,
coaches, officials, achievements, monitoring, reporting, and digital athlete
ID cards.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (SPA, mobile-first,
  later wrapped via Capacitor for Android/iOS webview)
- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Shared**: `@inasportdb/shared-types` — roles/enums/labels shared by
  frontend and backend
- **Approach**: Spec-Driven Development — see [`specs/`](./specs) for module
  specs written before implementation

## Project Structure

```
apps/
  web/      React SPA (Vite)
  api/      Express REST API (Prisma + PostgreSQL)
packages/
  shared-types/  Shared enums/DTOs (Role, statuses, labels)
specs/      Spec-Driven Development module specs
docs/       Design system notes, ERD
```

## Roles

| Role | Scope |
|---|---|
| `SUPER_ADMIN_KONI` | Full access, user management |
| `ADMIN_KONI` | Full access to all cabor, no user management |
| `ADMIN_CABOR` | Scoped to their own cabang olahraga |
| `ATLET` | Self-service: own profile, achievements, digital card |

## Local Development

```bash
cp .env.example .env
docker compose up -d        # start local Postgres (koni/koni/koni_batam)
npm install
npm run -w apps/api prisma:generate
npm run -w apps/api prisma:migrate   # or `npx prisma db push` if the DB user lacks CREATEDB
npm run -w apps/api prisma:seed
npm run dev:api              # API on http://localhost:4000
npm run dev:web              # SPA on http://localhost:5173
```

Seeded accounts (password `password123`):

| Email | Role |
|---|---|
| `superadmin@koni-batam.go.id` | `SUPER_ADMIN_KONI` |
| `admin@koni-batam.go.id` | `ADMIN_KONI` |
| `admincabor.atletik@koni-batam.go.id` | `ADMIN_CABOR` (Atletik) |

## Useful Scripts

| Command | Description |
|---|---|
| `npm run dev:web` / `npm run dev:api` | Run frontend / backend in dev mode |
| `npm run build` | Build `shared-types`, `api`, then `web` |
| `npm run lint` / `npm run typecheck` | Lint / typecheck all workspaces |
| `npm run -w apps/api prisma:generate` | Regenerate Prisma client |
| `npm run -w apps/api prisma:migrate` | Run Prisma migrations (requires DB CREATEDB perms) |
| `npm run -w apps/api prisma:seed` | Seed initial users/cabor |

## Specs

Each module is specified in `specs/<NNN-name>/spec.md` following the template
in `specs/_template/spec-template.md` before implementation. See
`specs/000-overview/` for the product overview, tech stack, and design system.

## Deployment

For deploying to a VPS with NGINX (reverse proxy, static SPA hosting, SSL,
process management), see [`SETUP.md`](./SETUP.md).
