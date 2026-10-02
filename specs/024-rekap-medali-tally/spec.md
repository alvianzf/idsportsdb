# Spec: Rekap Medali per Cabor (Medal Tally Surfacing)

## 1. Overview

- **Purpose & scope**: Surface the existing medal-tally data (already computed
  by `009-pelaporan`'s "Rekap Medali" report and by `002-dashboard`'s
  `perCabor.medals`) across the public site and the cabor detail pages, and
  give it a dedicated, interactive home: the public **`/medali`** hub page.
  No new entities — this is read surfacing of `Prestasi.medali` joined
  through `Atlet` to `CabangOlahraga`, the same source `009-pelaporan`
  already uses.
- **Already implemented before this spec (no change needed)**:
  - `GET /api/v1/reports/rekap-medali` — the admin, configurable-per-cabor/
    year/tingkat medal report (PDF/Excel/CSV export), reachable from the
    dashboard's **Pelaporan** nav item.
  - Dashboard home (`/dashboard`) — "Perolehan Medali" card (org-wide totals)
    and per-cabor medal badges in the "Statistik Atlet per Cabor" carousel.
- **What this spec adds**:
  1. Public **`/medali`** hub page (`MedaliIndexPage.tsx`) — the centerpiece
     medal-tally destination, linked from the top nav, the mobile bottom nav,
     and the landing page. Full per-cabor medal table plus **Tingkat
     Kejuaraan** and **Tahun** filter-card grids that combine (AND) and
     cross-filter each other's displayed counts.
  2. Public **`/medali/:jenis`** ranking page — every cabor ranked by one
     medal type (Emas/Perak/Perunggu).
  3. A medal-tally tab on the public `/data` page.
  4. A "Medali" tab (Rincian Medali — individual medal records by year) on
     each cabor's detail page, dashboard and public, alongside the existing
     always-visible Emas/Perak/Perunggu/Total summary.
  5. Back-link awareness: a cabor detail page's back button names the page
     the visitor actually came from.

## 2. Data Model

No new entities or columns. Reads `Prestasi.medali`/`tingkatKejuaraan`/
`tahun` joined through `Atlet` (excluding soft-deleted athletes) to
`CabangOlahraga`.

- `getCaborMedalTally(caborId)` — one cabor's `{ gold, silver, bronze, total }`
  (zeros instead of an absent row when it has no medals yet).
- `getRekapMedali(caborId, tahun?, tingkat?)` — per-cabor tally, optionally
  filtered by year and/or tingkat kejuaraan (both filters AND together).
- `getMedaliSummary()` — returns the raw **(tingkatKejuaraan, tahun) matrix**
  (one row per combination that has ≥1 medal, each with its own
  gold/silver/bronze/total), *not* pre-aggregated per dimension — the
  `/medali` hub's client computes both the Tingkat and Tahun card totals from
  this matrix so each can cross-filter by the other's active selection.

All in `apps/api/src/modules/reports/reports.service.ts`.

## 3. API Contract

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/cabor/:id` | authenticated (existing endpoint) | - | adds `medals: { gold, silver, bronze, total }` | via `getCaborMedalTally`, scoped like `jumlahAtlet`/`jumlahPelatih` |
| GET | `/api/v1/cabor/:id/prestasi` | authenticated | - | `Prestasi[]` incl. `atlet.namaLengkap` | reuses `getPrestasiReport(caborId)`; for the dashboard "Medali" tab; `rejectOtherCabor`-scoped same as `GET /cabor/:id` |
| GET | `/api/v1/public/cabor/:id/pengurus` | none | - | adds `cabor.medals: { gold, silver, bronze, total }` | |
| GET | `/api/v1/public/cabor/:id/prestasi` | none | - | `{ namaKejuaraan, tingkatKejuaraan, tahun, medali }[]` | no athlete name (privacy, same as the rest of `public.routes.ts`); medal records only (`GOLD`/`SILVER`/`BRONZE`) |
| GET | `/api/v1/public/rekap-medali` | none | `?tahun=&tingkat=` | `{ cabangOlahragaId, nama, gold, silver, bronze, total }[]` | public counterpart to `/reports/rekap-medali`, always all-cabor (no `?cabor=`); both filters optional and combinable |
| GET | `/api/v1/public/medali-summary` | none | - | `{ tingkatKejuaraan, tahun, gold, silver, bronze, total }[]` | the raw matrix (see §2); powers the `/medali` hub's filter cards |
| GET | `/api/v1/reports/rekap-medali` | admin roles | `?format=&cabor=&tahun=&tingkat=` | same shape as the public one, plus export | gained `?tingkat=` (`rekapMedaliQuerySchema`) |

- **Validation**: `/public/rekap-medali`'s `tahun`/`tingkat` use loose
  `Number()`/allowlist-against-`COMPETITION_LEVELS` parsing (no zod schema —
  consistent with other single-param public routes in this file). The admin
  route validates via `rekapMedaliQuerySchema` (zod).

## 4. UI / Pages

### `/medali` — the medal-tally hub (`MedaliIndexPage.tsx`)

- **Nav**: new top-level public menu item "Medali" (`PUBLIC_NAV` in
  `publicNav.ts`, desktop header) and bottom-nav tab (`PublicBottomNav.tsx`,
  `Medal` icon — "Cabor" moved to a `Building2` icon to avoid a duplicate).
- **Hero**: gradient banner with the org-wide, all-time medal total (`Trophy`
  icon).
- **Tingkat Kejuaraan cards**: one per tingkat that has ≥1 medal, in
  `COMPETITION_LEVEL_CHOICES` order. Each shows its own cross-filtered
  gold/silver/bronze/total (see below) and toggles `?tingkat=<value>` in the
  URL on click.
- **Tahun cards**: one per year that has ≥1 medal, newest first, same
  cross-filter + toggle behavior on `?tahun=<year>`.
- **Combining filters**: both `?tingkat=` and `?tahun=` can be set at once
  (AND) — selecting a Tingkat card no longer clears an active Tahun
  selection or vice versa; each toggle only touches its own query param.
  A combined-label chip (e.g. "Internasional · Tahun 2025") with a "×"
  clears both.
- **Cross-filtered card totals**: a Tingkat card's displayed tally reflects
  the currently-selected Tahun (if any), and a Tahun card's tally reflects
  the currently-selected Tingkat (if any) — computed client-side from the
  `/public/medali-summary` matrix via `useMemo`. A card is never hidden just
  because its cross-filtered count is 0; only cards for a tingkat/tahun that
  has *never* had any medal are omitted entirely.
- **Table**: `RekapMedaliTable` (shared with the `/data` Medali tab), fetched
  from `/public/rekap-medali?tingkat=&tahun=` and re-fetched whenever either
  filter changes; sorted by total descending.
- **Back-link**: cabor links in the table carry
  `state: { backTo: "/medali"+search, backLabel: "Kembali ke Perolehan Medali" }`.

### `/medali/:jenis` — ranking page (`MedaliRankingPage.tsx`)

- `jenis` = `emas` | `perak` | `perunggu`. Gradient hero themed to the medal
  color, animated progress-bar list of every cabor with ≥1 medal of that
  type, ranked descending. Back button (`navigate(-1)`), and cabor links
  carry `state: { backTo: "/medali/:jenis", backLabel: "Kembali ke Peringkat
  Medali <Jenis>" }`.
- Reached from the landing page by clicking an Emas/Perak/Perunggu figure on
  the "Perolehan Medali" card.

### `/data` — Medali tab (`DataPublicPage.tsx`)

- Third submenu tab, "Medali", alongside "Atlet"/"Tenaga Olahraga" (tab
  selection synced to `?tab=` in the URL). Renders `RekapMedaliTable` fetched
  from `/public/rekap-medali?tahun=`, with a "Semua Tahun" + recent-years
  `<select>` filter.

### Landing page (`LandingPage.tsx`)

- The four hero stat cards (Atlet Aktif, Cabang Olahraga, Pelatih, Total
  Medali) are links to `/data`, `/cabang-olahraga`, `/data?tab=tenaga`, and
  `/medali` respectively.
- "Perolehan Medali" card: a "Detail" link to `/medali`; each
  Emas/Perak/Perunggu figure links to `/medali/emas|perak|perunggu`.

### Cabor detail pages — "Medali" tab (`CaborMedaliDetail.tsx`)

- Shared by dashboard `CaborDetailPage.tsx` and public `CaborPublicPage.tsx`.
- **Always visible, above the tabs** (unchanged by this addition): header
  info/logo, and the "Perolehan Medali" summary (Emas/Perak/Perunggu/Total).
- **Below that, a real tab bar**: "Pengurus" (default — org structure +
  SK/Dokumen, as before) and "Medali" (`CaborMedaliDetail`) — same
  underlined-button tab style used by `/data`.
- `CaborMedaliDetail` itself: a year-chip filter ("Semua Tahun" + each year
  present, animated pill) and an animated list of that cabor's individual
  medal records (kejuaraan, tingkat label, tahun; athlete name on the
  dashboard side only — withheld on public for the same reason athlete names
  are censored elsewhere). Loading state is derived from `rows === null`
  (no separate `loading` prop). Empty state: "Belum ada perolehan medali."

- **Mobile**: all of the above reuses existing responsive patterns (grid →
  stacked, horizontal-scroll-free card wrapping); no new breakpoints.

## 5. Role-Based Behavior

| Role | View tally on `/cabor/:id` (incl. Medali tab) | View public pages (`/medali`, `/data`, cabor detail) |
|---|---|---|
| SUPER_ADMIN_KONI / ADMIN_KONI | ✅ any cabor | ✅ (no auth) |
| ADMIN_CABOR | ✅ own cabor only (`rejectOtherCabor`) | ✅ |
| ATLET | ❌ (not in nav) | ✅ |
| Anonymous | n/a | ✅ |

## 6. Acceptance Criteria

- Given `GET /cabor/:id` for a cabor with 2 gold/1 silver/0 bronze, then
  `medals = { gold: 2, silver: 1, bronze: 0, total: 3 }`; for a cabor with
  zero medals, `{ gold: 0, silver: 0, bronze: 0, total: 0 }` (not omitted).
- Given an anonymous visitor, `GET /public/rekap-medali`,
  `/public/medali-summary`, and `/public/cabor/:id/prestasi` all return `200`
  with no auth.
- Given `/medali`, when both an "Internasional" Tingkat card and a "2025"
  Tahun card are clicked, then the table shows only cabors with an
  Internasional medal in 2025, the Internasional card's own tally reflects
  only 2025, the 2025 card's tally reflects only Internasional, and other
  Tingkat/Tahun cards still render (showing 0 where there's no overlap)
  rather than disappearing.
- Given `/medali`, clicking an already-active card deselects just that
  dimension, leaving the other filter (if any) active.
- Given `/cabang-olahraga/:id` or dashboard `/cabor/:id`, the
  Emas/Perak/Perunggu/Total summary is visible without switching tabs, and
  switching to the "Medali" tab shows per-record detail without losing that
  summary.
- Given a cabor detail page reached by clicking a cabor name on `/medali`,
  `/medali/:jenis`, or the landing page's cabor grid, the back button reads
  "Kembali ke Perolehan Medali", "Kembali ke Peringkat Medali `<Jenis>`", or
  "Kembali ke beranda" respectively (default "Kembali ke daftar cabor" when
  reached directly).

## 7. Open Questions / Assumptions

- `/public/rekap-medali` omits `?cabor=` — a public visitor reaches a single
  cabor's tally via its detail page instead.
- No PDF/Excel export on any public medal view (that capability exists for
  admins via `/reports/rekap-medali`); public pages have no existing
  download pattern to extend.
- The `/medali` hub's hero "Total Perolehan Medali" is always the unfiltered,
  org-wide, all-time total — it does not react to the active Tingkat/Tahun
  filters (only the card totals and the table do).

## 8. Dependencies

- Depends on: `003-cabang-olahraga`, `007-prestasi-atlet`, `009-pelaporan`
  (reuses `getRekapMedali`/`getPrestasiReport`), `018-public-pages`.
  Additive-only; no existing endpoint's shape changes except additive fields
  (`medals` on `GET /cabor/:id` and `GET /public/cabor/:id/pengurus`) and an
  additive optional `?tingkat=` filter on both rekap-medali endpoints.
