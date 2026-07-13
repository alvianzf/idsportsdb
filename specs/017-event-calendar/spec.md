# Spec: Kalender Event (Event Calendar)

> Added by client revision 2026-07-12 — see `specs/000-overview/revisi-2026-07-12.md`.

## 1. Overview

- **Purpose & scope**: A calendar of KONI Batam events (kejuaraan, seleksi,
  rapat, kegiatan cabor) with a lifecycle status per event. Publicly visible:
  the landing page carries a "Kalender Event" menu that opens a public event
  list showing the event data.
- **Glossary**:
  - `Event` — a scheduled KONI/cabor activity (kejuaraan)
  - `Tingkat`: `KOTA_KABUPATEN | PROVINSI | NASIONAL | INTERNASIONAL | OPEN`
  - `Status`: `ON_TRACK` (berjalan sesuai rencana), `SELESAI` (done),
    `DIBATALKAN` (cancel), `DIUNDUR` (postponed)

## 2. Data Model

Fields per client note: tanggal, nama kejuaraan, tingkat, lokasi, status.

- **Entity**: `Event`
  - `id: String (uuid)`
  - `namaKejuaraan: String`
  - `tingkat: EventLevel`
  - `lokasi: String?`
  - `deskripsi: String?`
  - `tanggalMulai: DateTime`
  - `tanggalSelesai: DateTime?`
  - `cabangOlahragaId: String?` (FK → `CabangOlahraga`, optional — event may be
    KONI-wide)
  - `status: EventStatus @default(ON_TRACK)`
  - `createdAt`, `updatedAt`
- **Enums** (`@inasportdb/shared-types`):
  - `EventStatus` = `ON_TRACK | SELESAI | DIBATALKAN | DIUNDUR`
  - `EventLevel` = `KOTA_KABUPATEN | PROVINSI | NASIONAL | INTERNASIONAL | OPEN`
- **Indexes**: `tanggalMulai`, `status`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/public/events` | public (no auth) | `?limit=` | `Event[]` (with cabor name) | ordered by `tanggalMulai` desc; feeds the landing-page event menu |
| GET | `/api/v1/events` | all authenticated | `?status=&cabor=` | `Event[]` | |
| POST | `/api/v1/events` | SUPER_ADMIN_KONI, ADMIN_KONI | event fields | `Event` | |
| PATCH | `/api/v1/events/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | partial fields (incl. `status`) | `Event` | |
| DELETE | `/api/v1/events/:id` | SUPER_ADMIN_KONI | - | `204` | |

## 4. UI / Pages

> Revised (client note, 2026-07-12 — second pass): the calendar gets a clean
> Google-Calendar-like UI with multiple views, search, and admin drag-and-drop.

### Views (both public `/event` and admin `/events`)

A view switcher offers **four views** over the same filtered data set:

1. **Kalender** (default) — clean month grid; events render as colored pills
   on their date(s), multi-day events span across days. Month navigation
   (prev/today/next). Clicking an event opens a detail popover/modal.
2. **Card** — the existing card list (tanggal, nama kejuaraan, tingkat,
   lokasi, cabor, status badge).
3. **Table** — dense sortable table: Tanggal, Nama Kejuaraan, Tingkat,
   Lokasi, Cabor, Status.
4. **Gantt** — horizontal timeline; one row per event, bar spans
   tanggalMulai→tanggalSelesai (single-day events render a 1-day bar), bar
   color = status tone.

Status badge tones everywhere: SELESAI=success, ON_TRACK=info,
DIBATALKAN=danger, DIUNDUR=warning.

### Search & filter

- **Search box**: matches nama kejuaraan and cabor name; a date picker (or
  typing a date) jumps/filters to that date.
- **Filters** (combinable with search — "and/or"): status, tingkat, cabor.
- Search/filters apply to all four views identically.

### Admin interactions (`/events`, Google-Calendar-like)

- **Drag & drop**: dragging an event pill to another day reschedules it
  (`PATCH /events/:id` with shifted tanggalMulai/tanggalSelesai — duration
  preserved). Only SUPER_ADMIN_KONI/ADMIN_KONI can drag; others read-only.
- **Click a day cell** → opens the create-event modal pre-filled with that
  date; clicking an existing event opens the edit modal with full details
  (nama kejuaraan, tanggal mulai/selesai, tingkat, lokasi, cabor opsional,
  status, deskripsi).
- Delete for SUPER_ADMIN_KONI (inside the edit modal).
- Public `/event` calendar is identical minus drag/create/edit.

### Implementation notes

- Custom month-grid + gantt (Tailwind/CSS grid) rather than a heavy calendar
  dependency; drag-and-drop via native HTML5 DnD or `@dnd-kit/core` if
  needed. framer-motion for view transitions.

## 5. Acceptance Criteria

- Given an anonymous visitor, when they open the landing page and click
  "Kalender Event", then they see the events with their statuses without
  logging in, and can switch between Kalender/Card/Table/Gantt views.
- Given a search for a cabor name plus a status filter, then all four views
  show only events matching both.
- Given ADMIN_KONI on the admin calendar, when they drag a 3-day event to a
  new start date, then the event keeps its 3-day duration at the new dates
  and the change persists (`PATCH /events/:id`).
- Given ADMIN_KONI, when they click an empty day cell, then the create modal
  opens with that date pre-filled.
- Given ADMIN_KONI, when they change an event's status to `DIUNDUR`, then the
  public page reflects the new status badge.
- Given ADMIN_CABOR, when they `POST /api/v1/events`, then `403`; dragging is
  disabled for non-unscoped-admin roles.

## 6. Dependencies

- Depends on: `001-auth-rbac` (admin roles), `003-cabang-olahraga` (optional
  cabor link).
