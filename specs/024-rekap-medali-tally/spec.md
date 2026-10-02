# Spec: Rekap Medali per Cabor (Medal Tally Surfacing)

## 1. Overview

- **Purpose & scope**: Surface the existing medal-tally data (already computed
  by `009-pelaporan`'s "Rekap Medali" report and by `002-dashboard`'s
  `perCabor.medals`) in three places it was missing: the public **Data**
  page, each cabor's detail page (dashboard + public), and a public medal
  ranking view. No new entities — this is read surfacing of `Prestasi.medali`
  grouped by `CabangOlahraga`, same source `009-pelaporan` already uses.
- **Already implemented (no change needed)**, confirmed before writing this
  spec:
  - `GET /api/v1/reports/rekap-medali` (`?format=json|csv|excel|pdf`,
    `?cabor=`, `?tahun=`) — the configurable-per-cabor/year medal report,
    reachable from the dashboard's **Pelaporan** nav item →
    `/reports/rekap-medali`.
  - Dashboard home (`/dashboard`) — "Perolehan Medali" card (org-wide totals)
    and per-cabor medal badges in the "Statistik Atlet per Cabor" carousel.
  - These already satisfy "medal tally present on the dashboard" and "a
    report on medal tally configurable per cabor/year" from the request that
    prompted this spec.
- **Gaps this spec closes**:
  1. Public `/data` page has no medal-tally tab.
  2. Dashboard `/cabor/:id` detail page doesn't show that cabor's own tally.
  3. Public `/cabang-olahraga/:id` detail page doesn't show it either.

## 2. Data Model

No new entities or columns. Reads `Prestasi.medali` joined through `Atlet` to
`CabangOlahraga`, exactly as `009-pelaporan`'s `getRekapMedali()` does.

- **New service function**: `getCaborMedalTally(caborId)` in
  `apps/api/src/modules/reports/reports.service.ts` — thin wrapper around the
  existing `getRekapMedali(caborId)`, returning
  `{ gold, silver, bronze, total }` for one cabor (zeros when it has no
  medals yet, instead of the array being empty).

## 3. API Contract

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/cabor/:id` | authenticated (existing endpoint) | - | adds `medals: { gold, silver, bronze, total }` to the existing response | computed via `getCaborMedalTally`, scoped the same way `jumlahAtlet`/`jumlahPelatih` already are |
| GET | `/api/v1/public/cabor/:id/pengurus` | none (existing endpoint) | - | adds `cabor.medals: { gold, silver, bronze, total }` | same helper, no auth |
| GET | `/api/v1/public/rekap-medali` | none (new) | `?tahun=` | `{ cabangOlahragaId, nama, gold, silver, bronze, total }[]` | public counterpart to `/reports/rekap-medali`, always all-cabor (no `?cabor=` — a single-cabor filter has no use on an anonymous ranking view), sorted by `nama` (same as the admin report; the UI sorts by total desc) |

- **Validation**: `/public/rekap-medali`'s `tahun` reuses the same loose
  `Number(req.query.tahun) || undefined` parsing already used by
  `/public/events`'s `limit` — no new zod schema needed for one optional param.

## 4. UI / Pages

- **`/data` (public, `DataPublicPage.tsx`)**: third submenu tab **"Medali"**
  alongside "Atlet"/"Tenaga Olahraga". Fetches `/public/rekap-medali`, renders
  a table (Cabor, Emas, Perak, Perunggu, Total — same columns as
  `RekapMedaliReportPage`), sorted by Total descending, with a `<select>`
  year filter (same `tahunOptions` pattern as elsewhere, or a simple text-less
  "Semua Tahun" + a handful of recent years — reuses the page's existing
  `PAGE_SIZE`-free, no-pagination table style since cabor count is small).
- **`/cabor/:id` (dashboard, `CaborDetailPage.tsx`)**: a small "Perolehan
  Medali" block added to the header `Card`'s `<dl>` (next to Jumlah
  Atlet/Pelatih), rendered as three `Badge` tones (gold/silver/bronze)
  showing Emas/Perak/Perunggu, plus Total.
- **`/cabang-olahraga/:id` (public, `CaborPublicPage.tsx`)**: same
  gold/silver/bronze presentation, placed in the cabor header `Card` (below
  the logo/name block), using the plain-colored-text convention the public
  pages already use for medals (`MEDAL_TEXT` in `DataPublicPage.tsx`) rather
  than `Badge` pills (client note 2026-07-12: no badge pills on public pages).
- **Mobile**: tally rows/badges wrap; no new breakpoints needed — reuses
  existing responsive patterns of the host pages.

## 5. Role-Based Behavior

| Role | View tally on `/cabor/:id` | View tally on public pages |
|---|---|---|
| SUPER_ADMIN_KONI / ADMIN_KONI | ✅ any cabor | ✅ (public, no auth) |
| ADMIN_CABOR | ✅ own cabor only (existing `rejectOtherCabor` scoping) | ✅ |
| ATLET | ❌ (not in nav) | ✅ |
| Anonymous | n/a | ✅ |

## 6. Acceptance Criteria

- Given `GET /cabor/:id` for a cabor with 2 gold/1 silver/0 bronze, then
  `medals = { gold: 2, silver: 1, bronze: 0, total: 3 }`.
- Given `GET /cabor/:id` for a cabor with zero medals, then
  `medals = { gold: 0, silver: 0, bronze: 0, total: 0 }` (not omitted).
- Given an anonymous visitor, when `GET /public/rekap-medali`, then `200`
  with all cabor rows, no auth required.
- Given `/data`, when the "Medali" tab is selected, then a table of every
  cabor's tally renders, sorted by total descending.
- Given `/cabang-olahraga/:id` for a cabor with medals, then the tally is
  visible without navigating away from the page.

## 7. Open Questions / Assumptions

- `/public/rekap-medali` omits `?cabor=` — a public visitor reaches a single
  cabor's tally via `/cabang-olahraga/:id` instead; adding the filter would
  just duplicate that page.
- No PDF/Excel export on the public Medali tab (that capability already
  exists for admins via `/reports/rekap-medali`); public pages have no
  existing download pattern to extend.

## 8. Dependencies

- Depends on: `003-cabang-olahraga`, `007-prestasi-atlet`, `009-pelaporan`
  (reuses `getRekapMedali`), `018-public-pages`. Additive-only; no existing
  endpoint's shape changes except two additive fields (`medals` on `GET
  /cabor/:id` and `GET /public/cabor/:id/pengurus`).
