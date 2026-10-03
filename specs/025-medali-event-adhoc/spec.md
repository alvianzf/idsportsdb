# Spec: Event Medali Ad-Hoc (Multi-Kontingen Tally)

## 1. Overview

- **Purpose & scope**: A separate, admin-configured tally page for a single,
  current one-off multi-region competition KONI Batam competes in (e.g.
  "PORPROV KEPRI VI Tahun 2026") where the medal standings include **other
  Kabupaten/Kota**, not just Batam's own cabor. Distinct from
  `024-rekap-medali-tally`'s `/medali` hub, which only ever shows Batam's
  own medals filtered by tingkat/tahun — this spec adds the comparison
  dimension: how Batam stacks up against Bintan, Pinang, etc.
- **Only one event at a time**: there is at most one `MedaliEvent` row in
  the system. Creating a new one while one exists is rejected (`409`) — the
  admin edits or deletes the existing one first. This keeps the feature a
  simple "current event" config rather than an archive/list to maintain.
- **Wireframe**: user-supplied hand sketch — header naming the event, a
  "Total Perolehan Medali" hero number, a row of per-Kabupaten/Kota cards
  (Batam's own included), and below that a per-cabor medal table for
  whichever kontingen is selected.
- **Key design decision**: Batam's own tally is **never stored** for this
  feature — it is computed live from existing `Prestasi` records filtered by
  the event's `tingkatKejuaraan` + `tahun` (reusing `009-pelaporan`'s
  `getRekapMedali`), exactly like `024`'s hub already does. Only *other*
  kontingens' tallies are admin-entered, because KONI Batam has no system of
  record for their athletes. This keeps Batam's number always accurate as
  new Prestasi records are added, with zero duplicate data entry.
- **Front-page visibility**: when an event is configured, the landing page
  shows a compact card identifying it (logo/name) with its medal tally,
  linking to the full page — people shouldn't have to find `/medali` first.

## 2. Data Model

- **Entity**: `MedaliEvent` — the one active ad-hoc event config (at most one
  row ever exists — enforced in the service layer, not a DB constraint,
  since "zero rows" is also a valid state).
  - `id: String (uuid)`
  - `nama: String` — e.g. "PORPROV KEPRI VI"
  - `tingkatKejuaraan: CompetitionLevel` — reuses the existing enum (Modul F);
    drives the live computation of Batam's own tally
  - `tahun: Int`
  - `logoUrl: String?` — optional, event/competition logo
  - `createdAt`, `updatedAt`
- **Entity**: `MedaliEventKontingen` — one *other* Kabupaten/Kota participating.
  - `id: String (uuid)`
  - `medaliEventId: String` (FK → `MedaliEvent`, cascade delete)
  - `nama: String` — e.g. "Bintan" (unique per event)
  - `createdAt`, `updatedAt`
- **Entity**: `MedaliEventKontingenTally` — one kontingen's medal count for
  one cabang olahraga.
  - `id: String (uuid)`
  - `kontingenId: String` (FK → `MedaliEventKontingen`, cascade delete)
  - `cabangOlahragaId: String` (FK → `CabangOlahraga`) — reuses KONI's own
    master sport list so columns/names line up with Batam's own table
  - `gold: Int @default(0)`, `silver: Int @default(0)`, `bronze: Int @default(0)`
  - `@@unique([kontingenId, cabangOlahragaId])` — one row per cabor per
    kontingen; admin only creates a row for a cabor the kontingen actually
    won a medal in (sparse, same convention as `getRekapMedali` omitting
    zero-medal cabors).
- **Not stored**: Batam's own per-cabor breakdown and totals (computed via
  `getRekapMedali(null, event.tahun, event.tingkatKejuaraan)`).

## 3. API Contract

| Method | Path | Roles | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/medali-event` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `MedaliEvent \| null` | the current event (with `kontingen[]`), or `null` |
| POST | `/api/v1/medali-event` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ nama, tingkatKejuaraan, tahun }` | `MedaliEvent` | `409` if one already exists |
| PATCH | `/api/v1/medali-event/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | partial fields | `MedaliEvent` | |
| DELETE | `/api/v1/medali-event/:id` | SUPER_ADMIN_KONI | - | `204` | cascades kontingen + their tally rows; system returns to "no event" |
| POST | `/api/v1/medali-event/:id/logo` | SUPER_ADMIN_KONI, ADMIN_KONI | multipart `file` | `{ logoUrl }` | same pattern as `POST /cabor/:id/logo` |
| POST | `/api/v1/medali-event/:id/kontingen` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ nama }` | `MedaliEventKontingen` | `nama` unique within the event (409 on dup) |
| PATCH | `/api/v1/medali-event/kontingen/:kontingenId` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ nama }` | `MedaliEventKontingen` | |
| DELETE | `/api/v1/medali-event/kontingen/:kontingenId` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `204` | cascades its tally rows |
| PUT | `/api/v1/medali-event/kontingen/:kontingenId/tally/:cabangOlahragaId` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ gold, silver, bronze }` | `MedaliEventKontingenTally` | upsert — creates the row if absent, overwrites counts if present; all-zero deletes the row instead (keeps the sparse convention) |
| GET | `/api/v1/public/medali-event` | none | - | see §3.1, or `null` | single source for the `/medali/event` page **and** the landing-page card |

### 3.1 `GET /public/medali-event` response shape (`null` when none configured)

```ts
{
  event: { id, nama, tahun, tingkatKejuaraan, logoUrl },
  kontingen: Array<{
    id: string;            // "own" for Batam (synthetic, not a DB id)
    nama: string;          // "Batam (Kontingen Kita)" for our own
    isOwn: boolean;
    gold: number; silver: number; bronze: number; total: number;
    caborTally: Array<{ cabangOlahragaId, nama, gold, silver, bronze, total }>;
  }>;                       // Batam's entry always first, rest sorted by total desc
  grandTotal: number;       // sum of every kontingen's total, incl. Batam
}
```

- **Validation**: `apps/api/src/modules/medaliEvent/medaliEvent.schema.ts` —
  `createMedaliEventSchema`/`updateMedaliEventSchema` (`tahun` same
  1900–next-year bound as other report year fields), `tallySchema`
  (`gold`/`silver`/`bronze` non-negative ints).

## 4. UI / Pages

### Admin (dashboard)

- **New nav item "Event Medali"** → `/medali-event`. Single-config page, not
  a list:
  - **No event configured**: a form (Nama, Tingkat, Tahun, Logo) to create
    one.
  - **Event configured**: edit form for the same fields; a read-only
    preview of Batam's own computed tally (so the admin can see what's live
    without leaving the page); a "Kabupaten & Kota" section listing
    kontingen (add/rename/delete) with, per kontingen, an inline per-cabor
    tally editor (`Combobox` of `CabangOlahraga` + three number inputs for
    Emas/Perak/Perunggu, reusing the `PUT .../tally/:cabangOlahragaId`
    upsert — save as zero to remove a row); a "Hapus Event" action.

### Public

- **`/medali` hub** gains a compact "Event" banner/link when one is
  configured (logo + nama + tahun → `/medali/event`); absent entirely when
  none is configured.
- **Landing page (`/`)** gains a compact card — placed near the existing
  "Perolehan Medali" section — showing the event's logo/nama/tahun
  (identification) and its `grandTotal` plus Batam's own Emas/Perak/Perunggu
  (tally), linking to `/medali/event`. Rendered only when an event is
  configured; otherwise the section doesn't appear (no empty state on the
  landing page).
- **`/medali/event`** — the sketch (no `:id` — there's only ever one):
  1. Header: event logo (if any) + "Perolehan Medali — `<nama>` Tahun
     `<tahun>`".
  2. Hero card: "Total Perolehan Medali" — `grandTotal`.
  3. "Kabupaten & Kota" card grid — one card per kontingen (Batam's card
     visually marked, e.g. a small badge, and always first), each showing a
     mini Emas/Perak/Perunggu readout (colored dot + count, the same
     convention `024`'s `MiniTally` already established — no ambiguous
     letter abbreviations) and its Total. Cards are click-toggle filters,
     same interaction model as `024`'s Tingkat/Tahun cards.
  4. Table, directly below the cards:
     - **No card selected ("Total Tally", the default/main view)**: a
       leaderboard — one row per kontingen (incl. Batam), columns
       Kontingen/Emas/Perak/Perunggu/Total, sorted by Total descending.
     - **A card selected**: the table swaps to that kontingen's own
       `caborTally` — Cabor/Emas/Perak/Perunggu/Total, same shape/columns as
       `024`'s `RekapMedaliTable` (reused). Clicking the already-selected
       card deselects it, returning to the leaderboard.
  5. Back button (`navigate(-1)`), consistent with `024`'s ranking page.
  6. **No event configured**: friendly empty state, not a 404 (this route
     always exists; its content depends on whether an event is set up).
- **Mobile**: card grid collapses to 2-across then 1-across; table reuses
  `DataTable`'s existing mobile-collapse behavior.

## 5. Role-Based Behavior

| Role | View public event page / landing card | Manage the event (`/medali-event`) | Manage kontingen + tally |
|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ | ✅ create/edit/delete | ✅ |
| ADMIN_KONI | ✅ | ✅ create/edit (no delete) | ✅ |
| ADMIN_CABOR / ADMIN_DISPORA | ✅ | ❌ (not in nav) | ❌ |
| ATLET | ✅ | ❌ | ❌ |
| Anonymous | ✅ | n/a | n/a |

## 6. Acceptance Criteria

- Given no `MedaliEvent` exists, when `POST /medali-event`, then `201` and
  it becomes the current event; a second `POST /medali-event` then returns
  `409` until the first is deleted.
- Given a configured event with `tingkatKejuaraan=PORPROV, tahun=2026`, when
  `GET /public/medali-event`, then the Batam entry's `caborTally` and totals
  exactly match `GET /public/rekap-medali?tingkat=PORPROV&tahun=2026` — no
  separate data entry needed for our own medals.
- Given an admin enters `gold=2` for kontingen "Bintan" / cabor "Renang",
  then that kontingen's card total updates, and selecting its card shows
  "Renang" in the table.
- Given a kontingen with zero medals entered, then `PUT
  .../tally/:caborId` with `{gold:0,silver:0,bronze:0}` deletes any existing
  row instead of leaving a 0/0/0 row.
- Given no card is selected, then the table shows every kontingen ranked by
  total descending, Batam included.
- Given the "Batam" card is clicked then clicked again, then the table
  returns to the Total Tally leaderboard.
- Given no event is configured, then neither the landing page nor `/medali`
  shows any event section, and `/medali/event` shows its empty state rather
  than erroring.
- Given an event is configured, then the landing page shows its name and
  tally without the visitor navigating anywhere first.

## 7. Open Questions / Assumptions

- Other kontingens' tallies are entered **per cabor** (not one aggregate
  number) so their table matches Batam's shape exactly and the UI can reuse
  one table component — the wireframe's blank "Bintan"/"Pinang" cards (shown
  as dashes, no data yet) are consistent with either reading; per-cabor was
  chosen for UI consistency, accepting the extra admin data-entry cost.
  **Assumption, not explicitly confirmed with the client.**
- "Only one event at a time" is enforced as "at most one row, full stop" —
  not a date-ranged "active" flag. Running two ad-hoc events concurrently
  (unlikely for a PORPROV-scale competition) is out of scope; the admin
  would delete the old one first.
- No bulk/CSV import for kontingen tallies in v1 — manual per-cabor entry
  only, consistent with how `Prestasi` itself is entered one record at a
  time.
- No PDF/Excel export for the ad-hoc event page.
- `MedaliEvent.nama` is not required to be unique beyond the singleton
  constraint itself.

## 8. Dependencies

- Depends on: `003-cabang-olahraga` (FK target for kontingen tally rows),
  `007-prestasi-atlet` (Batam's own live tally source),
  `024-rekap-medali-tally` (reuses `getRekapMedali`, the `/medali` hub as
  the entry point, and the `MiniTally`/`RekapMedaliTable` UI conventions).
