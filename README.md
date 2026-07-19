# KONI Batam — Sports Management System

Full-stack web application for KONI Batam (Komite Olahraga Nasional Indonesia, Batam chapter). Manages sport disciplines, athletes, coaches, officials, achievements, monitoring, reporting, and digital athlete ID cards. Packaged as a native mobile app via Capacitor for Android and iOS.

---

## Features

### Dashboard
- Live aggregate counts: active athletes, coaches, sport disciplines, achievements
- Year-filtered achievement stat card (year picker, 2020–present) with all-time total
- Medal tally breakdown (Emas · Perak · Perunggu) as coloured badge chips
- Per-sport-discipline athlete/coach breakdown (KONI admins only)
- Real-time updates via WebSocket (`atlet:change`, `prestasi:change`)

### Cabang Olahraga (Sport Disciplines)
- Full CRUD with search; delete blocked (409) when athletes or coaches exist
- Organisation logo upload via drag-and-drop; national federation name field
- **SK & Dokumen Resmi** — upload, list, and delete official documents (PDF/DOC/image) with type, number, date, and description
- Pengurus (officials) management embedded in detail page (see below)

### Atlet (Athletes)
- Full CRUD with pagination, search, and filters (cabor, status, kecamatan)
- Multi-cabor support: primary + additional sport disciplines per athlete
- Per-athlete document vault (classified; served behind authentication)
- Status lifecycle: `ACTIVE` / `INACTIVE` / `RETIRED`
- Bulk delete

### Pelatih (Coaches)
- Full CRUD with pagination and cabor filter
- License tracking: number, level, and expiry date with approaching-expiry warning badge
- Bulk delete

### Pengurus Cabor (Sport Branch Officials)
- Officials roster per cabor: position, term dates, contact
- Three interchangeable views on the cabor detail page:
  - **Tabel** — DataTable (Nama · Jabatan · Status always visible; Melapor Kepada · Masa Bakti · Kontak collapsible)
  - **Kartu** — nested cards indented by hierarchy depth
  - **Struktur** — interactive org-chart with split drag-and-drop overlay:
    - Drop on **top half** of a card → swap positions (jabatan + reportsToId exchanged, direct reports redirected, parent↔child cycles safely resolved)
    - Drop on **bottom half** → reparent (set `reportsToId` to target)
    - Drop zone below chart → promote to top-level (null reportsToId)

### Prestasi Atlet (Achievements)
- Full CRUD with filters: cabor, year, competition level, medal type
- Medals: Emas / Perak / Perunggu / Tanpa Medali with colour-coded badges
- Competition levels: Internasional · Nasional · Regional · Provinsi · Kota
- Optional ranking field (`peringkat`)
- Pagination and bulk delete

### Monitoring Atlet
- Four event types: **Cedera** (injury) · **Mutasi** (transfer) · **Pemusatan Latihan** (training camp) · **Seleksi** (selection)
- Tabbed view; real-time updates via WebSocket
- Mutation approval workflow: PENDING → APPROVED / REJECTED (KONI admins only)
- DataTable with collapsible secondary columns

### Pelaporan (Reports)
- Atlet per Cabor — breakdown by sport discipline
- Atlet per Usia — age group distribution
- Atlet per Kecamatan — geographic distribution
- Pelatih — coach roster report
- Prestasi — achievement report with filters
- Rekap Medali — medal tally summary
- Export to PDF and Excel

### Kartu Atlet Digital (Digital Athlete ID Card)
- Auto-generated QR card per athlete with unique card code
- Printable card with athlete photo, name, cabor, and KONI Batam branding
- Public verification page at `/verify/:cardCode` (no login required)
- Card revocation support

### Scanner
- Full-screen QR scanner at `/scan`
- Web: native `BarcodeDetector` API (Chrome/Android) with `jsQR` fallback
- Native (Android/iOS): ML Kit barcode scanning via `@capacitor-mlkit/barcode-scanning`
- Responsive viewfinder box (60% of shorter viewport dimension, clamped 240–420px)
- On successful scan → verifies card via API → navigates to athlete record page
- Error states: camera denied, unrecognised QR, card not found / expired / revoked

### Rekam Atlet (Athlete Record)
- Quick-record page reachable after a successful card scan
- Log monitoring events (injury, training camp, selection) directly from the scan flow

### Pengumuman / Artikel (Announcements)
- Rich-text CMS using TipTap editor; image upload support
- Published / draft state management
- Public-facing article page at `/artikel/:slug`

### Pengguna (User Management)
- User list, create, edit, and deactivate (SUPER_ADMIN_KONI only)
- Role assignment; ADMIN_CABOR users are scoped to a single cabang olahraga
- Bulk deactivate

### Atlet Self-Service (`/me`)
- Athletes view their own profile, achievement history, and digital ID card
- Download / share their QR card

---

## UI & UX

- **Responsive layout**: collapsible sidebar on desktop and tablet; bottom nav bar on mobile
- **Tablet**: sidebar defaults to icon-only mode on viewports < 1024 px; expands on demand
- **Mobile bottom nav**: Dashboard · Atlet · **Scan** (centre FAB) · Monitoring · Pelaporan
- **DataTable**: sortable columns, bulk selection, CSS container-query responsive collapse — key columns always visible, secondary columns fold behind a chevron expand; compact on mobile/tablet, full on desktop
- **Framer Motion**: page-transition animations (fade + slide on every route change), sidebar nav hover-slide, bottom-nav tap spring, optional card hover lift
- **Animated Suspense loader**: spinning KONI-red ring + pulsing label while lazy chunks load

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4 |
| State | Zustand (auth/session), local component state |
| Routing | React Router v6 — lazy-loaded route chunks |
| Animations | Framer Motion |
| Rich text | TipTap |
| Backend | Node.js, Express, TypeScript |
| ORM / DB | Prisma + PostgreSQL |
| Real-time | Socket.IO |
| Mobile | Capacitor (Android + iOS webview) |
| Shared types | `@inasportdb/shared-types` — roles, enums, labels |
| API middleware | `compression` (gzip), `helmet` (security headers), CORS |

## Roles & Permissions

| Role | Scope |
|---|---|
| `SUPER_ADMIN_KONI` | Full access including user management and hard deletes |
| `ADMIN_KONI` | Full data access across all cabor; no user management |
| `ADMIN_CABOR` | Read/write scoped to their own cabang olahraga |
| `ATLET` | Self-service: own profile, achievements, digital card |

---

## Project Structure

```
apps/
  web/      React SPA (Vite + Capacitor)
  api/      Express REST API (Prisma + PostgreSQL + Socket.IO)
packages/
  shared-types/  Shared enums, roles, and labels
specs/      Spec-Driven Development module specs (gitignored locally)
```

## Local Development

```bash
cp .env.example .env
docker compose up -d             # start local Postgres (koni/koni/koni_batam)
npm install
npm run -w apps/api prisma:generate
npm run -w apps/api prisma:migrate   # or prisma db push if the DB user lacks CREATEDB
npm run -w apps/api prisma:seed
npm run dev:api                  # API on http://localhost:4000
npm run dev:web                  # SPA on http://localhost:5173
```

Seeded accounts (password `password123`, override with `SEED_PASSWORD`):

| Email | Role |
|---|---|
| `superadmin@simo-konibatam.com` | `SUPER_ADMIN_KONI` |

The seed creates only this account plus the 48 cabang olahraga. Demo atlet,
pelatih, pengurus, prestasi and article data were removed at handover.

## Scripts

| Command | Description |
|---|---|
| `npm run dev:web` / `npm run dev:api` | Run frontend / backend in dev mode |
| `npm run build` | Build shared-types → api → web |
| `npm run lint` / `npm run typecheck` | Lint / typecheck all workspaces |
| `npm run -w apps/api prisma:generate` | Regenerate Prisma client |
| `npm run -w apps/api prisma:migrate` | Run migrations (requires CREATEDB) |
| `npm run -w apps/api prisma:seed` | Seed initial users and cabor |

## Deployment

See [`SETUP.md`](./SETUP.md) for VPS deployment with NGINX, SSL, and process management.
