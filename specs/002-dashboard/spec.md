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

| Method | Path | Roles Allowed | Query Params | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/dashboard/all` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?tahun=<year>` | `{ summary, perCabor, prestasiStats }` | **Primary endpoint** — returns all dashboard data in one request (see §3.1). `ADMIN_CABOR` scoped to own cabor. |
| GET | `/api/v1/dashboard/summary` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?tahun=<year>` | `{ activeAtletCount, pelatihCount, caborCount, prestasiCount, prestasiCountAll, tahun }` | Legacy single-section endpoint; kept for compatibility. |
| GET | `/api/v1/dashboard/stats/per-cabor` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `[{ cabangOlahragaId, nama, atletCount, pelatihCount }]` | Not shown to `ADMIN_CABOR`. Legacy; prefer `/all`. |
| GET | `/api/v1/dashboard/stats/prestasi` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?groupBy=medali\|tahun\|tingkatKejuaraan` | `[{ key, count }]` | Legacy; `/all` always uses `groupBy=medali`. |

### 3.1 `/dashboard/all` response shape

```ts
{
  summary: {
    activeAtletCount: number;
    pelatihCount: number;
    caborCount: number;
    prestasiCount: number;      // prestasi in the requested tahun
    prestasiCountAll: number;   // all-time total
    tahun: number;
  };
  perCabor: Array<{             // null for ADMIN_CABOR (scoped to one cabor)
    cabangOlahragaId: string;
    nama: string;
    atletCount: number;
    pelatihCount: number;
  }> | null;
  prestasiStats: Array<{ key: string; count: number }>; // grouped by medali
}
```

### 3.2 Implementation notes

- **All data — summary counts, `perCabor`, and `prestasiStats` — are fetched in
  a single `$queryRaw` round-trip** via `fetchAll()` in `dashboard.routes.ts`.
  The query uses correlated sub-SELECTs for the five scalar counts plus
  `json_agg` subqueries for the two array results.
- `perCabor` is `NULL` in the SQL when `caborId` is set (ADMIN_CABOR); the JS
  layer returns it as `null` to the client in that case.
- `Prisma.groupBy()` and `findMany({ _count })` were intentionally avoided —
  both open new DB connections on each call. Against a remote PostgreSQL host
  (~20ms RTT) each cold connection costs 100–500ms, making them prohibitively
  slow in any `Promise.all` pattern.
- **Measured performance**: 22–46ms warm, ~100ms after a cold server start
  (a `SELECT 1` warmup fires when the HTTP server starts to pre-establish the
  pool). Previous baseline: 2–7s.
- `/stats/prestasi` legacy endpoint also uses `$queryRaw` (not `groupBy`) for
  the same reason.
- No caching for v1 (city-level data volume stays small).
- See `specs/016-indexing/spec.md` for the DB index strategy that underpins
  these query plans.

## 4. UI / Pages

- **Route**: `/dashboard` (`apps/web/src/pages/DashboardPage.tsx`)
- **Mobile**: stat cards in a `grid-cols-2` grid; "Statistik per Cabor" and
  "Statistik Prestasi" cards stack vertically below.
- **Desktop**: stat cards in `grid-cols-4`; stats cards in `md:grid-cols-2`.
- **Components**: `StatCard` (icon + label + value), `Card`, `Badge`.
- **Year filter**: A `<select>` above the stat grid lets the user pick a
  `tahun` (year) from the current year back to 2020. Changing the year
  re-fetches `GET /dashboard/all?tahun=<year>` and updates `prestasiCount`
  (the "Prestasi `<year>`" stat card). `prestasiCountAll` (total all-time) is
  displayed as a small annotation below the grid and is unaffected by the year
  filter.
- **Prestasi stats**: `prestasiStats` from `/dashboard/all` (medal breakdown) —
  rendered as `Badge` chips (Emas / Perak / Perunggu); `NONE` entries filtered.
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
