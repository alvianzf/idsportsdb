# Spec: Data Pengurus Cabor (Sport Branch Officials)

## 1. Overview

- **Purpose & scope**: Tracks the board/officials of each sport discipline
  (e.g. chairperson, secretary, treasurer) and their term of service.
- **PDF reference**: Modul D — "Data Pengurus Cabor" (page 2)
- **Glossary**:
  - `Pengurus` — official/board member
  - `Jabatan` — position/title
  - `Masa Bakti` — term of service (start–end)
  - `Kontak` — contact info (phone/email)

## 2. Data Model

- **Entity**: `PengurusCabor`
  - `id: String (uuid)`
  - `cabangOlahragaId: String` (FK → `CabangOlahraga`)
  - `namaPengurus: String`
  - `jabatan: String` — free text (e.g. "Ketua", "Sekretaris", "Bendahara")
  - `masaBaktiMulai: DateTime`
  - `masaBaktiAkhir: DateTime`
  - `kontak: String?`
  - `reportsToId: String?` — self-FK → `PengurusCabor.id`; the official this
    person reports to ("Melapor Kepada"). `null` = top of the org structure.
  - `createdAt`, `updatedAt`
- **Relationships**: many-to-one → `CabangOlahraga`; self-relation
  `reportsTo`/`reports` (one org chart per cabor — `reportsToId` must point to
  a `PengurusCabor` row with the same `cabangOlahragaId`, enforced in the API)
- **Indexes**: index on `cabangOlahragaId`, index on `reportsToId`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/cabor/:caborId/pengurus` | all authenticated | `?active=true` | `PengurusCabor[]` | `active=true` filters `masaBaktiAkhir >= today`; `ADMIN_CABOR` can view any cabor's officials (read-only, like `003`) |
| POST | `/api/v1/cabor/:caborId/pengurus` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ namaPengurus, jabatan, masaBaktiMulai, masaBaktiAkhir, kontak?, reportsToId? }` | `PengurusCabor` | `reportsToId` must reference a pengurus in the same cabor (`400` otherwise) |
| PATCH | `/api/v1/pengurus/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | partial fields incl. `reportsToId` | `PengurusCabor` | rejects self-reference and circular chains (`400`); used by the org-chart drag-and-drop to reassign a node's parent |
| DELETE | `/api/v1/pengurus/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `204` | children of a deleted pengurus have `reportsToId` set to `null` (`onDelete: SetNull`) |

- **Validation**: `apps/api/src/modules/pengurus/pengurus.schema.ts`
  (`createPengurusSchema`, `updatePengurusSchema`) — `masaBaktiAkhir` after
  `masaBaktiMulai`; `reportsToId` is a nullable uuid.

## 4. UI / Pages

- **`/pengurus`** — list of all officials across cabor, filterable by Cabor
  (dropdown — for ADMIN_CABOR, defaults to and is locked to own cabor for
  context, but they cannot edit). Columns: Nama, Cabor, Jabatan, Masa Bakti
  (with `Badge`: `success` if active term, `neutral` if past).
- **`/pengurus/new`** — form: Cabor (select), Nama Pengurus, Jabatan, Masa
  Bakti (date range), Kontak, Melapor Kepada (select, options = other pengurus
  in the same cabor, default "Tidak ada (paling atas)").
- **`/pengurus/:id/edit`** — same form, pre-filled.
- Also surfaced as a read-only/managed section within **`/cabor/:id`** (per
  `003-cabang-olahraga` §4), via `apps/web/src/pages/cabor/PengurusOrgViews.tsx`.
- **Mobile**: list → stacked cards (nama, jabatan, cabor, masa bakti badge).

### Struktur Organisasi (org structure views)

The pengurus section of `/cabor/:id` offers three interchangeable views via a
tab/segmented-control switcher:

- **Tabel** — flat table with columns Nama, Jabatan, Melapor Kepada (resolved
  to the parent's `namaPengurus`, or "-" for top-level), Masa Bakti, Status,
  Aksi.
- **Kartu** — cards nested/indented per hierarchy depth (recursive tree of
  cards), each showing nama, jabatan, masa bakti, kontak, status badge.
- **Struktur** (org chart) — top-down tree diagram of boxes connected by
  lines. For SUPER_ADMIN_KONI/ADMIN_KONI, each box is **draggable** (HTML5
  drag-and-drop). Each target box shows a **split drop overlay** when a drag
  is in progress:
  - **Top half** ("Tukar posisi") — drops here **swap positions** between the
    dragged node and the target: jabatan and reportsToId are exchanged and
    direct reports are redirected so the org hierarchy is preserved. For a
    direct parent↔child pair, the child moves into the parent's slot and the
    parent into the child's slot (no cycle created). Deep ancestor/descendant
    swaps are blocked (toast error).
  - **Bottom half** ("Jadikan bawahan") — drops here **reparents** the dragged
    node: sends `PATCH /pengurus/:id { reportsToId: <target.id> }`.
  - **"Lepaskan di sini..."** zone below the chart sets `reportsToId: null`
    (promotes to top-level).
  - Read-only for other roles (no drag handles).

## 5. Role-Based Behavior

| Role | View | Create | Update | Delete | Scope |
|---|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ | all cabor |
| ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ | all cabor |
| ADMIN_CABOR | ✅ all (read-only) | ❌ | ❌ | ❌ | n/a |
| ATLET | ❌ (not in nav) | ❌ | ❌ | ❌ | n/a |

## 6. Acceptance Criteria

- Given SUPER_ADMIN_KONI, when `POST /cabor/:caborId/pengurus` with
  `masaBaktiAkhir < masaBaktiMulai`, then `400` validation error.
- Given ADMIN_CABOR, when `POST /cabor/:caborId/pengurus` (any cabor including
  own), then `403`.
- Given `?active=true`, when `GET /cabor/:caborId/pengurus`, then only officials
  with `masaBaktiAkhir >= today` are returned.
- Given SUPER_ADMIN_KONI/ADMIN_KONI, when `PATCH /pengurus/:id` with
  `reportsToId` set to itself or to a descendant (forming a cycle), then `400`.
- Given SUPER_ADMIN_KONI/ADMIN_KONI, when `PATCH /pengurus/:id` with
  `reportsToId` referencing a pengurus from a different cabor, then `400`.
- Given a pengurus with children (`reports`), when it is deleted, then its
  children's `reportsToId` becomes `null` (they become top-level).

## 7. Open Questions / Assumptions

- None — fields map directly to the PDF.

## 8. Dependencies

- Depends on: `001-auth-rbac`, `003-cabang-olahraga`. Built in Phase 3.
