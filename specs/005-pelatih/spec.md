# Spec: Data Pelatih (Coach Data)

## 1. Overview

- **Purpose & scope**: Master list of coaches, their licenses, and which sport
  discipline they belong to.
- **PDF reference**: Modul C — "Data Pelatih" (page 1–2)
- **Glossary**:
  - `Nomor Lisensi` — coaching license number
  - `Tingkatan Lisensi` — license level/grade
  - `Masa Berlaku Lisensi` — license validity period
  - `Riwayat Kepelatihan` — coaching history

## 2. Data Model

- **Entity**: `Pelatih`
  - `id: String (uuid)`
  - `namaPelatih: String`
  - `nomorLisensi: String @unique`
  - `cabangOlahragaId: String` (FK → `CabangOlahraga`)
  - `tingkatanLisensi: String` — free text for v1 (e.g. "Nasional", "Daerah");
    not enumerated since the PDF doesn't define a fixed list
  - `masaBerlakuMulai: DateTime?`
  - `masaBerlakuAkhir: DateTime?`
  - `riwayatKepelatihan: String? @db.Text` — free text, see §7
  - `createdAt`, `updatedAt`
- **Relationships**: many-to-one → `CabangOlahraga`
- **Indexes**: unique on `nomorLisensi`, index on `cabangOlahragaId`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/pelatih` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?cabor=&search=&page=&pageSize=&expiring=true` | `{ items: Pelatih[], total }` | `ADMIN_CABOR` forced to own cabor; `expiring=true` filters `masaBerlakuAkhir` within 90 days (for license renewal UI) |
| GET | `/api/v1/pelatih/:id` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | - | `Pelatih` | |
| POST | `/api/v1/pelatih` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `Pelatih` fields | `Pelatih` | `ADMIN_CABOR`: `cabangOlahragaId` forced to own |
| PATCH | `/api/v1/pelatih/:id` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | partial fields | `Pelatih` | |
| DELETE | `/api/v1/pelatih/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `204` | |

- **Validation**: `apps/api/src/modules/pelatih/pelatih.schema.ts`
  (`createPelatihSchema`, `updatePelatihSchema`) — `masaBerlakuAkhir` must be
  after `masaBerlakuMulai` if both present.

## 4. UI / Pages

- **`/pelatih`** — list with filters (Cabor — locked for ADMIN_CABOR, search by
  name/license number). Columns: Nama, Cabor, Nomor Lisensi, Tingkatan, Masa
  Berlaku (with a `Badge` if expiring/expired). "Tambah Pelatih" button.
- **`/pelatih/new`, `/pelatih/:id/edit`** — form: Nama Pelatih, Cabor (locked
  for ADMIN_CABOR), Nomor Lisensi, Tingkatan Lisensi, Masa Berlaku (date range),
  Riwayat Kepelatihan (textarea).
- **`/pelatih/:id`** — detail card showing all fields + riwayat as a text block.
- **Mobile**: list → stacked cards (nama, cabor, license badge); form fields
  stacked.
- **Components**: `Badge` for license status — `success` (valid), `warning`
  (expiring ≤90 days), `danger` (expired, computed from `masaBerlakuAkhir` vs.
  today).

## 5. Role-Based Behavior

| Role | View | Create | Update | Delete | Scope |
|---|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ | all cabor |
| ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ | all cabor |
| ADMIN_CABOR | ✅ own cabor | ✅ (own cabor) | ✅ (own cabor) | ❌ | own `cabangOlahragaId` |
| ATLET | ❌ (not in nav) | ❌ | ❌ | ❌ | n/a |

## 6. Acceptance Criteria

- Given a duplicate `nomorLisensi`, when `POST /pelatih`, then `409`.
- Given `masaBerlakuAkhir` within 90 days of today, when `GET /pelatih`, then
  that coach's license `Badge` renders with `warning` tone; if past, `danger`.
- Given ADMIN_CABOR for "Atletik", when `GET /pelatih?cabor=<other>`, then
  results are still filtered to "Atletik".

## 7. Open Questions / Assumptions

- `riwayatKepelatihan` is a free-text field for v1. If structured history
  (multiple entries with dates/clubs/roles) is needed later, introduce a
  `PelatihRiwayat` child table (`pelatihId`, `peran`, `tempat`, `mulai`,
  `selesai`) — not built now to avoid premature complexity.
- `tingkatanLisensi` is free text (no enum) since the PDF doesn't enumerate
  values; revisit if a fixed taxonomy (e.g. Lisensi D/C/B/A, Daerah/Nasional/
  Internasional) is confirmed.

## 8. Dependencies

- Depends on: `001-auth-rbac`, `003-cabang-olahraga`. Required by:
  `002-dashboard` (pelatih count), `009-pelaporan` (data pelatih report). Built
  in Phase 2 alongside `004-atlet`.
