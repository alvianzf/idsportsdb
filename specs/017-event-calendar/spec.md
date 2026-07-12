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

- **Landing page** — header menu "Kalender Event" → `/event` (public).
- **`/event`** (public, no auth) — event list showing the event data: tanggal
  (range), nama kejuaraan, tingkat, lokasi, cabor, and a status `Badge`
  (SELESAI=success, ON_TRACK=info, DIBATALKAN=danger, DIUNDUR=warning).
- **`/events`** (admin, `AppLayout`) — table of events with status filter;
  create/edit via modal form (nama kejuaraan, tanggal mulai/selesai, tingkat,
  lokasi, cabor opsional, status, deskripsi). Write actions for
  SUPER_ADMIN_KONI/ADMIN_KONI; delete for SUPER_ADMIN_KONI.

## 5. Acceptance Criteria

- Given an anonymous visitor, when they open the landing page and click
  "Kalender Event", then they see the list of events with their statuses
  without logging in.
- Given ADMIN_KONI, when they change an event's status to `DIUNDUR`, then the
  public page reflects the new status badge.
- Given ADMIN_CABOR, when they `POST /api/v1/events`, then `403`.

## 6. Dependencies

- Depends on: `001-auth-rbac` (admin roles), `003-cabang-olahraga` (optional
  cabor link).
