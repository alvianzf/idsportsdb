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

---

## Changelog

### Public medal-tally hub + ranking + detail (added)

- **New top-level public menu "Medali"** (`PUBLIC_NAV`, `PublicBottomNav`) →
  `/medali` (`MedaliIndexPage.tsx`), the centerpiece medal-tally page. Shows:
  the full `RekapMedaliTable` (same shared component as `/data`'s Medali
  tab), a **Tingkat Kejuaraan** filter-card grid, and a **Tahun** filter-card
  grid — each card shows a mini Emas/Perak/Perunggu readout and, when
  clicked, filters the table to that dimension (`?tingkat=`/`?tahun=` in the
  URL, one active filter at a time, with a clear/"×" chip).
  - New endpoint `GET /api/v1/public/medali-summary` → `{ byTingkat, byTahun
    }` totals (via `getMedaliSummary()`, `prisma.prestasi.groupBy`).
  - `GET /api/v1/public/rekap-medali` and the admin `GET
    /api/v1/reports/rekap-medali` both gained an optional `?tingkat=` filter
    (`getRekapMedali(caborId, tahun?, tingkat?)`).
- **New `/medali/:jenis` ranking page** (`MedaliRankingPage.tsx`,
  `jenis` = `emas`/`perak`/`perunggu`) — every cabor that won that medal
  type, ranked descending with an animated progress-bar list; reached by
  clicking the Emas/Perak/Perunggu figure on the landing page's "Perolehan
  Medali" card.
- **Landing page** (`LandingPage.tsx`): the four hero stat cards (Atlet
  Aktif/Cabang Olahraga/Pelatih/Total Medali) are now links to their
  respective public pages; "Perolehan Medali" card gained a "Detail" link to
  `/medali`.
- **Per-cabor medal detail tab** (`CaborMedaliDetail.tsx`, shared by
  dashboard `CaborDetailPage.tsx` and public `CaborPublicPage.tsx`): an
  interactive year-chip filter + animated list of that cabor's individual
  medal records (kejuaraan, tingkat, tahun; athlete name on the dashboard
  side only). Sits below the existing Emas/Perak/Perunggu/Total summary,
  which is unchanged. New endpoints: `GET /api/v1/cabor/:id/prestasi`
  (authenticated, reuses `getPrestasiReport`, includes athlete name) and
  `GET /api/v1/public/cabor/:id/prestasi` (no auth, no athlete name).
- **Back-link awareness**: cabor detail links from `RekapMedaliTable`,
  `MedaliRankingPage`, and the landing page's cabor grid now carry router
  `state: { backTo, backLabel }`; `CaborPublicPage`'s back button reads it
  (via `useLocation().state`, falling back to "Kembali ke daftar cabor") so
  it names the page the visitor actually came from (e.g. "Kembali ke
  Perolehan Medali", "Kembali ke Peringkat Medali Emas").
