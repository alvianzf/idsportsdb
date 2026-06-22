# Spec: Dashboard Utama (Main Dashboard)

## 1. Overview

- **Purpose & scope**: Landing page after login. Shows aggregate counts and
  statistics across athletes, coaches, sport disciplines, and achievements.
- **PDF reference**: Modul A — "Dashboard Utama" (page 1)
- **Glossary**:
  - `Jumlah atlet aktif` — count of athletes with `statusAtlet = ACTIVE`
  - `Jumlah pelatih` — total coach count
  - `Jumlah cabang olahraga` — total sport discipline count
  - `Statistik atlet per cabor` — athlete count grouped by `CabangOlahraga`
  - `Statistik prestasi` — achievement counts, e.g. by medal type / year

## 2. Data Model

No new entities. Aggregates over `Atlet`, `Pelatih`, `CabangOlahraga`, `Prestasi`
(defined in `003-cabang-olahraga`, `004-atlet`, `005-pelatih`, `007-prestasi-atlet`).

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/dashboard/summary` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?tahun=<year>` | `{ activeAtletCount, pelatihCount, caborCount, prestasiCount, prestasiCountAll, tahun }` | `ADMIN_CABOR`: all counts scoped to `req.scopedCaborId`; `caborCount` for that role is always `1` (own cabor); `prestasiCount` = prestasi in the given `tahun`; `prestasiCountAll` = prestasi across all years |
| GET | `/api/v1/dashboard/stats/per-cabor` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `[{ cabangOlahragaId, nama, atletCount, pelatihCount }]` | Not shown to `ADMIN_CABOR` (single-cabor view makes this redundant) |
| GET | `/api/v1/dashboard/stats/prestasi` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?groupBy=medali\|tahun\|tingkatKejuaraan` | `[{ key, count }]` | scoped for `ADMIN_CABOR` via athlete's cabor |

- **Implementation**: Prisma `count()`/`groupBy()` queries; no caching for v1
  (low data volume expected for a city-level KONI chapter).

## 4. UI / Pages

- **Route**: `/dashboard` (`apps/web/src/pages/DashboardPage.tsx`)
- **Mobile**: stat cards in a `grid-cols-2` grid; "Statistik per Cabor" and
  "Statistik Prestasi" cards stack vertically below.
- **Desktop**: stat cards in `grid-cols-4`; stats cards in `md:grid-cols-2`.
- **Components**: `StatCard` (icon + label + value), `Card`, `Badge`.
- **Year filter**: A `<select>` above the stat grid lets the user pick a
  `tahun` (year) from the current year back to 2020. Changing the year
  re-fetches `GET /dashboard/summary?tahun=<year>` and updates `prestasiCount`
  (the "Prestasi `<year>`" stat card). `prestasiCountAll` (total all-time) is
  displayed as a small annotation below the grid and is unaffected by the year
  filter.
- **Prestasi stats**: `GET /dashboard/stats/prestasi?groupBy=medali` — results
  are rendered as `Badge` chips (Emas / Perak / Perunggu); `NONE` entries are
  filtered out of the display.
- **Empty/loading/error**: while fetching, show `—` placeholders; on error,
  show inline `Card` with danger text.

## 5. Role-Based Behavior

| Role | View | Scope |
|---|---|---|
| SUPER_ADMIN_KONI | ✅ | all cabor |
| ADMIN_KONI | ✅ | all cabor |
| ADMIN_CABOR | ✅ | own cabor only; "per cabor" comparison chart hidden |
| ATLET | ❌ (redirected to `/me`) | n/a |

## 6. Acceptance Criteria

- Given a SUPER_ADMIN_KONI or ADMIN_KONI user, when `/dashboard` loads, then it
  displays `activeAtletCount`, `pelatihCount`, `caborCount`, `prestasiCount` for
  the whole organization, plus a per-cabor breakdown.
- Given an ADMIN_CABOR user, when `/dashboard` loads, then all counts reflect
  only their `cabangOlahragaId`, and the per-cabor breakdown is not shown.
- Given no data yet (empty DB), when `/dashboard` loads, then all counts show
  `0` (not an error).

## 7. Open Questions / Assumptions

- "Statistik prestasi" grouping dimension not specified by PDF beyond "statistik
  prestasi" — defaulting to medal-type breakdown (`groupBy=medali`) as the
  primary dashboard chart. `groupBy=tahun` and `groupBy=tingkatKejuaraan` are
  available via the API but not yet exposed in the UI.

## 8. Dependencies

- Depends on: `001-auth-rbac` (role scoping), `003-cabang-olahraga`,
  `004-atlet`, `005-pelatih`, `007-prestasi-atlet` (data sources). Implemented
  in Phase 2 (live counts) after those models exist; UI shell built in Phase 1.

---

## Changelog

### Medal tally excludes NONE (changed)
- Dashboard "Statistik Prestasi (Medali)" badge list now filters out `NONE`
  entries — only Emas, Perak, Perunggu are shown in the tally.
