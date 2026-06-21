# Spec: Data Cabang Olahraga (Sport Discipline Master Data)

## 1. Overview

- **Purpose & scope**: Master list of sport disciplines ("cabor") under KONI
  Batam. Other modules (Atlet, Pelatih, Pengurus Cabor) reference a cabor via
  foreign key, and `ADMIN_CABOR` users are scoped to one cabor.
- **PDF reference**: Modul E — "Data Cabang Olahraga" (page 2)
- **Glossary**:
  - `Cabor` — short for Cabang Olahraga (sport discipline/branch)
  - `Ketua Cabor` — head of the sport discipline
  - `Sekretariat` — secretariat address

## 2. Data Model

- **Entity**: `CabangOlahraga`
  - `id: String (uuid)`
  - `nama: String @unique` — e.g. "Atletik", "Bulu Tangkis"
  - `ketuaCabor: String?`
  - `sekretariat: String?`
  - `createdAt`, `updatedAt`
- **Derived fields** (not stored, computed via `_count`):
  - `jumlahAtlet` — `Atlet` rows where `cabangOlahragaId = this.id`
  - `jumlahPelatih` — `Pelatih` rows where `cabangOlahragaId = this.id`
- **Relationships**: one-to-many → `Atlet`, `Pelatih`, `PengurusCabor`, `User`
  (for `ADMIN_CABOR` scoping)

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/cabor` | all authenticated | `?search=` | `CabangOlahraga[]` with `jumlahAtlet`/`jumlahPelatih` | `ADMIN_CABOR` sees all cabor (read-only) for context, but can only edit own |
| GET | `/api/v1/cabor/:id` | all authenticated | - | `CabangOlahraga` + counts + `pengurus[]` (from `006-pengurus-cabor`) | |
| POST | `/api/v1/cabor` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ nama, ketuaCabor?, sekretariat? }` | `CabangOlahraga` | `nama` must be unique |
| PATCH | `/api/v1/cabor/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | partial fields | `CabangOlahraga` | |
| DELETE | `/api/v1/cabor/:id` | SUPER_ADMIN_KONI | - | `204` | blocked (409) if `jumlahAtlet > 0` or `jumlahPelatih > 0` |

- **Validation**: `apps/api/src/modules/cabor/cabor.schema.ts` (`createCaborSchema`,
  `updateCaborSchema`)

## 4. UI / Pages

- **`/cabor`** — list/table: Nama, Ketua Cabor, Jumlah Atlet, Jumlah Pelatih,
  actions. Search box. "Tambah Cabor" button (SUPER_ADMIN_KONI/ADMIN_KONI only).
- **`/cabor/new`, `/cabor/:id/edit`** — form: Nama, Ketua Cabor, Sekretariat.
- **`/cabor/:id`** — detail: header card (nama, ketua, sekretariat, counts),
  tab/section listing `PengurusCabor` entries (from `006-pengurus-cabor`), and a
  link to filtered `/atlet?cabor=:id` / `/pelatih?cabor=:id`.
- **Mobile**: list renders as stacked cards (nama + counts + chevron) instead of
  a wide table; detail page sections stack vertically.
- **Components**: `Card`, `Badge` (not heavily used here), standard table/form.
- **Empty state**: "Belum ada cabang olahraga" + CTA to add (admins only).

## 5. Role-Based Behavior

| Role | View | Create | Update | Delete |
|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ |
| ADMIN_KONI | ✅ all | ✅ | ✅ | ❌ |
| ADMIN_CABOR | ✅ all (read-only) | ❌ | ❌ | ❌ |
| ATLET | ❌ (not in nav) | ❌ | ❌ | ❌ |

## 6. Acceptance Criteria

- Given an authenticated user, when `GET /cabor`, then each item includes live
  `jumlahAtlet`/`jumlahPelatih` counts.
- Given SUPER_ADMIN_KONI/ADMIN_KONI, when `POST /cabor` with a duplicate `nama`,
  then `409 Conflict`.
- Given SUPER_ADMIN_KONI, when `DELETE /cabor/:id` for a cabor with existing
  athletes, then `409 Conflict` with a message explaining the block.
- Given ADMIN_CABOR, when `PATCH /cabor/:id` (any id, including own), then `403`.

## 7. Open Questions / Assumptions

- None — this module's fields match the PDF exactly (`jumlahAtlet`/`jumlahPelatih`
  intentionally derived rather than stored, see `specs/000-overview` design notes).

## 8. Dependencies

- Depends on: `001-auth-rbac`. Required by: `004-atlet`, `005-pelatih`,
  `006-pengurus-cabor` (FK target), `002-dashboard` (per-cabor stats). Built in
  Phase 2, first among the master-data modules since others FK to it.
