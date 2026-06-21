# Spec: Data Prestasi Atlet (Athlete Achievements)

## 1. Overview

- **Purpose & scope**: Records competition results/achievements per athlete —
  feeds the dashboard's "statistik prestasi" and the "rekap medali" /
  "data prestasi" reports.
- **PDF reference**: Modul F — "Data Prestasi Atlet" (page 2)
- **Glossary**:
  - `Nama Kejuaraan` — competition/championship name
  - `Tingkat Kejuaraan` — competition level: Kota/Provinsi/Nasional/Internasional
  - `Medali` — medal (gold/silver/bronze/none)
  - `Peringkat` — ranking (for non-medal results)
  - `Sertifikat` — achievement certificate (file)

## 2. Data Model

- **Entity**: `Prestasi`
  - `id: String (uuid)`
  - `atletId: String` (FK → `Atlet`, cascade delete)
  - `namaKejuaraan: String`
  - `tingkatKejuaraan: CompetitionLevel` (`KOTA | PROVINSI | NASIONAL |
    INTERNASIONAL`)
  - `tahun: Int`
  - `medali: Medal` (`GOLD | SILVER | BRONZE | NONE`)
  - `peringkat: Int?`
  - `sertifikatUrl: String?`
  - `createdAt`, `updatedAt`
- **Enums**: `CompetitionLevel`, `Medal` (`@inasportdb/shared-types`)
- **Indexes**: index on `atletId`, `tahun`, `medali`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/prestasi` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?cabor=&tahun=&medali=&tingkat=&page=&pageSize=` | `{ items: (Prestasi & { atlet: {id, namaLengkap, cabangOlahragaId} })[], total }` | `ADMIN_CABOR` restricted to athletes in own cabor |
| GET | `/api/v1/atlet/:atletId/prestasi` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor), ATLET (self) | - | `Prestasi[]` | used by `/atlet/:id` Prestasi tab and `/me/prestasi` |
| POST | `/api/v1/atlet/:atletId/prestasi` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | `{ namaKejuaraan, tingkatKejuaraan, tahun, medali, peringkat? }` | `Prestasi` | |
| PATCH | `/api/v1/prestasi/:id` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor athlete) | partial fields | `Prestasi` | |
| DELETE | `/api/v1/prestasi/:id` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor athlete) | - | `204` | |
| POST | `/api/v1/prestasi/:id/sertifikat` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor athlete) | multipart: `file` | `Prestasi` (with `sertifikatUrl`) | stores via `lib/storage.ts`, same pattern as `004-atlet` documents |

- **Validation**: `apps/api/src/modules/prestasi/prestasi.schema.ts`
  (`createPrestasiSchema`, `updatePrestasiSchema`) — `tahun` reasonable range
  (e.g. 1950–current year+1); `peringkat` required when `medali = NONE`
  (optional otherwise).

## 4. UI / Pages

- **`/prestasi`** — global list across all athletes (admin views), filterable
  by Cabor (locked for ADMIN_CABOR), Tahun, Medali, Tingkat Kejuaraan. Columns:
  Atlet, Cabor, Kejuaraan, Tingkat, Tahun, Medali (`Badge` gold/silver/bronze),
  Peringkat.
- **Prestasi tab within `/atlet/:id`** — list of this athlete's achievements +
  "Tambah Prestasi" form (modal or inline), each row with sertifikat
  upload/download.
- **`/me/prestasi`** (ATLET) — read-only list of own achievements, same columns
  minus Atlet/Cabor.
- **Mobile**: list → stacked cards (kejuaraan + year + medal badge); add-form
  as a bottom sheet/modal.
- **Components**: `Badge` with `gold`/`silver`/`bronze`/`neutral` (for
  `medali = NONE`, show `Peringkat` instead, tone `info`).

## 5. Role-Based Behavior

| Role | View | Create | Update | Delete | Scope |
|---|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ | all |
| ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ | all |
| ADMIN_CABOR | ✅ own cabor athletes | ✅ | ✅ | ✅ | own cabor's athletes |
| ATLET | ✅ own (`/me/prestasi`) | ❌ | ❌ | ❌ | self |

## 6. Acceptance Criteria

- Given `medali = NONE`, when `POST .../prestasi` without `peringkat`, then
  `400` validation error.
- Given ADMIN_CABOR for "Atletik", when `POST /atlet/:atletId/prestasi` where
  `atletId` belongs to a different cabor, then `403`.
- Given an ATLET user, when `GET /atlet/:atletId/prestasi` for their own
  `athleteId`, then `200`; for any other `atletId`, `403`.
- Given `?groupBy` on the dashboard stats endpoint (`002-dashboard`), the
  `Prestasi.medali`/`tahun` fields are the source data.

## 7. Open Questions / Assumptions

- None beyond `peringkat` requirement noted above (PDF lists both "Medali" and
  "Peringkat" without specifying when each applies — assumption: medal-winners
  use `medali`, non-medal placements use `peringkat`, both may be present).

## 8. Dependencies

- Depends on: `001-auth-rbac`, `004-atlet`. Required by: `002-dashboard`,
  `009-pelaporan` (data prestasi, rekap medali). Built in Phase 3.
