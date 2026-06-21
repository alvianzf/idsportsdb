# Spec: Pelaporan (Reporting)

## 1. Overview

- **Purpose & scope**: Generates the six reports listed in the PDF, each
  exportable as PDF and Excel.
- **PDF reference**: Modul H — "Pelaporan" (page 3)
- **Reports**:
  1. Data atlet per cabor (athletes by sport discipline)
  2. Data atlet per usia (athletes by age)
  3. Data atlet per kecamatan (athletes by sub-district)
  4. Data pelatih (coaches)
  5. Data prestasi (achievements)
  6. Rekap medali (medal recap)

## 2. Data Model

No new entities. Reads from `Atlet`, `CabangOlahraga`, `Pelatih`, `Prestasi`
(see `003`–`005`, `007`). "Usia" (age) is computed from
`Atlet.tanggalLahir` at request time (not stored).

## 3. API Contract

| Method | Path | Roles Allowed | Query Params | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/reports/atlet-per-cabor` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?format=json\|pdf\|excel` | grouped counts/list | `ADMIN_CABOR` scoped to own cabor (single-row result) |
| GET | `/api/v1/reports/atlet-per-usia` | same | `?format=&bucket=5` (age bucket size, default 5 years) | age-bucketed counts | scoped for ADMIN_CABOR |
| GET | `/api/v1/reports/atlet-per-kecamatan` | same | `?format=` | counts grouped by `kecamatan` | scoped for ADMIN_CABOR |
| GET | `/api/v1/reports/pelatih` | same | `?format=&cabor=` | `Pelatih[]` (full listing) | scoped for ADMIN_CABOR |
| GET | `/api/v1/reports/prestasi` | same | `?format=&tahun=&tingkat=&medali=` | `Prestasi[]` with athlete/cabor joined | scoped for ADMIN_CABOR |
| GET | `/api/v1/reports/rekap-medali` | same | `?format=&tahun=&cabor=` | counts of GOLD/SILVER/BRONZE per cabor (and total) | scoped for ADMIN_CABOR |

- **`format=json`** (default) returns structured data for on-screen
  preview/table. **`format=pdf`** streams a PDF (`Content-Type:
  application/pdf`, `Content-Disposition: attachment`) via `lib/pdf.ts`
  (pdfkit). **`format=excel`** streams an `.xlsx` via `lib/excel.ts` (exceljs).
- **Shared query builder**: `apps/api/src/modules/reports/reports.service.ts`
  exposes one data-fetch function per report, reused by the JSON/PDF/Excel
  renderers (single source of truth for filtering/scoping logic).
- **Validation**: `apps/api/src/modules/reports/reports.schema.ts`
  (`reportQuerySchema` — common `format`/`cabor`/`tahun` params per report).

## 4. UI / Pages

- **`/reports`** — index page: 6 cards (one per report), each with a short
  description and a "Lihat" button.
- **`/reports/atlet-per-cabor`**, **`/reports/atlet-per-usia`**,
  **`/reports/atlet-per-kecamatan`**, **`/reports/pelatih`**,
  **`/reports/prestasi`**, **`/reports/rekap-medali`** — each page has a
  filter form (relevant subset of: Cabor, Tahun, Tingkat, Medali) at the top,
  an on-screen preview table/chart below, and "Unduh PDF" / "Unduh Excel"
  buttons that hit the same endpoint with `?format=pdf|excel` (triggers
  browser download).
- **Mobile**: filter form stacks; preview table becomes horizontally
  scrollable; download buttons remain visible (sticky footer optional).
- **Components**: `Card`, standard table, `Button` (outline variant for
  download actions).
- **Empty state**: "Tidak ada data untuk filter ini."

## 5. Role-Based Behavior

| Role | View | Scope |
|---|---|---|
| SUPER_ADMIN_KONI | ✅ all 6 reports | all cabor |
| ADMIN_KONI | ✅ all 6 reports | all cabor |
| ADMIN_CABOR | ✅ all 6 reports | own cabor only (single-cabor results) |
| ATLET | ❌ (not in nav) | n/a |

## 6. Acceptance Criteria

- Given any report endpoint with `?format=pdf`, then response
  `Content-Type: application/pdf` and a valid PDF is returned containing the
  same data as `?format=json`.
- Given any report endpoint with `?format=excel`, then response
  `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  and the `.xlsx` opens with the same rows as `?format=json`.
- Given ADMIN_CABOR, when requesting `/reports/atlet-per-cabor`, then the
  result contains only their own cabor's row.
- Given `/reports/atlet-per-usia?bucket=5`, then athletes are grouped into
  5-year age buckets (e.g. 15–19, 20–24, ...) computed from
  `Atlet.tanggalLahir`.

## 7. Open Questions / Assumptions

- Age bucket size defaults to 5 years (not specified by PDF) — configurable via
  `?bucket=`.
- "Rekap medali" assumed grouped by cabor + medal type, with an optional
  `?tahun=` filter; PDF doesn't specify the exact grouping dimension.

## 8. Dependencies

- Depends on: `003-cabang-olahraga`, `004-atlet`, `005-pelatih`,
  `007-prestasi-atlet`. Built in Phase 4, after those modules exist.
