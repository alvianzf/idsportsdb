# Spec: Monitoring Atlet (Athlete Monitoring)

## 1. Overview

- **Purpose & scope**: Tracks athlete lifecycle events — status changes,
  injuries, transfers between cabor, training camp participation, and
  selection processes — as a unified timeline per athlete.
- **PDF reference**: Modul G — "Monitoring Atlet" (page 2)
- **Glossary**:
  - `Status aktif/nonaktif` — active/inactive status (mirrors `Atlet.statusAtlet`)
  - `Cedera` — injury
  - `Mutasi atlet` — athlete transfer (between cabor, possibly between regions)
  - `Pemusatan latihan` — centralized training camp
  - `Seleksi atlet` — athlete selection process

## 2. Data Model

- **Entity**: `MonitoringEvent` — unified timeline log (see §7 for rationale)
  - `id: String (uuid)`
  - `atletId: String` (FK → `Atlet`, cascade delete)
  - `type: MonitoringEventType` (`INJURY | MUTATION | TRAINING_CAMP | SELECTION
    | STATUS_CHANGE`)
  - `description: String? @db.Text`
  - `fromValue: String?` — e.g. previous `cabangOlahragaId`/status
  - `toValue: String?` — e.g. new `cabangOlahragaId`/status
  - `mutationStatus: MutationStatus?` (`PENDING | APPROVED | REJECTED`) — only
    meaningful when `type = MUTATION`
  - `eventDate: DateTime @default(now())`
  - `createdById: String` (FK → `User`)
  - `createdAt: DateTime @default(now())`
- **Enums**: `MonitoringEventType`, `MutationStatus` (`@inasportdb/shared-types`)
- **Indexes**: index on `(atletId, type)`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/atlet/:atletId/monitoring` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor), ATLET (self) | `?type=` | `MonitoringEvent[]` | ordered by `eventDate desc`; powers Monitoring tab on `/atlet/:id` |
| POST | `/api/v1/atlet/:atletId/monitoring` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | `{ type, description?, fromValue?, toValue?, eventDate? }` | `MonitoringEvent` | for `type=STATUS_CHANGE`, also updates `Atlet.statusAtlet = toValue`; for `type=MUTATION`, creates with `mutationStatus=PENDING` and does **not** change `Atlet.cabangOlahragaId` yet |
| GET | `/api/v1/monitoring` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?type=` | `MonitoringEvent[]` (with `atlet` summary) | cross-athlete feed, max 200 rows newest-first; `ADMIN_CABOR` scoped to own cabor; powers the `/monitoring` global list page |
| PATCH | `/api/v1/monitoring/:id` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor, non-mutation only) | partial fields | `MonitoringEvent` | |
| GET | `/api/v1/monitoring/mutasi` | SUPER_ADMIN_KONI, ADMIN_KONI | `?status=PENDING\|APPROVED\|REJECTED` | `MonitoringEvent[]` (with `atlet` summary) | approval queue; default `status=PENDING` |
| PATCH | `/api/v1/monitoring/:id/mutasi` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ status: APPROVED \| REJECTED }` | `MonitoringEvent` | on `APPROVED`, updates `Atlet.cabangOlahragaId = toValue` and `Atlet.statusAtlet` back to `ACTIVE` if it was `TRANSFERRED` |

- **Validation**: `apps/api/src/modules/monitoring/monitoring.schema.ts`
  (`createMonitoringEventSchema`) — `mutationStatus` only settable via the
  dedicated `/mutasi` endpoint, not via generic `PATCH`.

## 4. UI / Pages

- **`/monitoring`** — tabbed view: **Cedera | Mutasi | Pemusatan Latihan |
  Seleksi**. Each tab is a filtered list (`type=...`) across all athletes
  (scoped per role), with columns: Atlet, Cabor, Tanggal, Deskripsi.
  - **Mutasi tab**: additionally shows `mutationStatus` `Badge` and, for
    SUPER_ADMIN_KONI/ADMIN_KONI, "Setujui"/"Tolak" actions (approval queue from
    `GET /monitoring/mutasi`).
- **Monitoring tab within `/atlet/:id`** — combined timeline (all types,
  newest first) for that athlete, with a "Tambah Catatan" button opening a
  form (type selector + description + date, and for MUTATION: target cabor
  selector).
- **Mobile**: tabs become a horizontally-scrollable segment control; timeline
  renders as a vertical list of cards with type icon + date + description.
- **Components**: `Badge` for `mutationStatus` (warning=PENDING,
  success=APPROVED, danger=REJECTED) and for `AthleteStatus` changes.

## 5. Role-Based Behavior

| Role | View | Create | Approve Mutasi |
|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ |
| ADMIN_KONI | ✅ all | ✅ | ✅ |
| ADMIN_CABOR | ✅ own cabor | ✅ (own cabor; mutasi requests only, not approvals) | ❌ |
| ATLET | ✅ own (read-only, via `/atlet/:id`-equivalent self view if added) | ❌ | ❌ |

## 6. Acceptance Criteria

- Given ADMIN_CABOR, when `POST /atlet/:id/monitoring` with `type=MUTATION,
  toValue=<otherCaborId>`, then a `MonitoringEvent` is created with
  `mutationStatus=PENDING` and `Atlet.cabangOlahragaId` is **unchanged**.
- Given ADMIN_KONI, when `PATCH /monitoring/:id/mutasi` with
  `status=APPROVED`, then `Atlet.cabangOlahragaId` updates to `toValue` and the
  event's `mutationStatus` becomes `APPROVED`.
- Given `type=STATUS_CHANGE` with `toValue=INJURED`, when
  `POST /atlet/:id/monitoring`, then `Atlet.statusAtlet` becomes `INJURED`.
- Given ADMIN_CABOR, when `PATCH /monitoring/:id/mutasi`, then `403`.

## 7. Open Questions / Assumptions

- **Unified vs. separate tables**: chose one `MonitoringEvent` log table over 4
  separate tables (injuries, transfers, training camps, selections) for
  simplicity and a natural "timeline" UI. Trade-off: weaker per-type field
  typing (e.g. injury severity/recovery date would be free text in
  `description` for v1). If stronger typing is needed (e.g. structured injury
  severity/recovery tracking), revisit by adding type-specific JSON in a
  `details: Json?` column rather than new tables — flagged for review once
  real usage patterns are known.
- Mutation approval changes `cabangOlahragaId` but does not currently re-check
  `nomorRegistrasi` uniqueness/format per-cabor (none specified in PDF).

## 8. Dependencies

- Depends on: `001-auth-rbac`, `004-atlet`. Built in Phase 3.

---

## Bug fix

### PATCH /monitoring/:id missing socket emit (fixed)
- `PATCH /api/v1/monitoring/:id` was not emitting `monitoring:change` via
  socket.io, so the `/monitoring` page did not refresh after editing an event.
- Fix: `emit("monitoring:change")` added after successful `prisma.monitoringEvent.update`.
