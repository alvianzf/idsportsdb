# Tech Stack

## Frontend (`apps/web`)

- **React 19 + TypeScript** (Vite)
- **Tailwind CSS v4** (CSS-first `@theme` config in `src/index.css`) — see `design-system.md`
- **React Router v6** — SPA routing, see `src/routes/AppRouter.tsx`
- **zustand** — auth/session state (`src/store/authStore.ts`), persisted to `localStorage`
- **axios** — API client (`src/lib/api.ts`), attaches JWT bearer token
- **lucide-react** — icons
- **@fontsource/plus-jakarta-sans** — self-hosted font (offline-safe for mobile webview)

Mobile porting: the SPA is built to static assets (`apps/web/dist`) and wrapped with
**Capacitor** (Phase 6) for Android/iOS. Layouts are mobile-first; bottom nav on
small screens, sidebar on desktop (`src/layouts/`).

## Backend (`apps/api`)

- **Node.js 22 + Express + TypeScript**
- **Prisma** ORM + **PostgreSQL**
- **zod** — request validation
- **jsonwebtoken** + **bcryptjs** — auth (access/refresh JWT, password hashing)
- **multer** — file uploads (documents, photos, certificates) → local disk in dev
  behind a storage adapter (`src/lib/storage.ts`)
- **pdfkit** — PDF report/card generation
- **exceljs** — Excel report generation
- **qrcode** — QR codes for digital athlete cards
- **nanoid** — opaque card verification tokens

## Shared

- **`packages/shared-types`** — `Role`, status enums (`AthleteStatus`, `Medal`,
  `CompetitionLevel`, etc.), and label maps shared by both apps. Single source of
  truth so frontend badges/route-guards and backend zod validation never drift.

## Database

- PostgreSQL, schema managed via `apps/api/prisma/schema.prisma`.
- **Note**: the configured remote database user does not have `CREATEDB`
  permission, so `prisma migrate dev` (which needs a shadow database) cannot be
  used against it. Use `npx prisma db push` to sync schema changes during
  development against that database. `docker-compose.yml` provides a local
  Postgres with full permissions if migration history (`prisma migrate dev`) is
  needed.

## Tooling

- npm workspaces monorepo (`apps/*`, `packages/*`)
- ESLint (flat config, typescript-eslint) + TypeScript project references
- GitHub Actions CI (`.github/workflows/ci.yml`): install → prisma generate →
  typecheck → lint → build
