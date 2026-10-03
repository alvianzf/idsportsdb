# Spec: Event Medali Ad-Hoc (Multi-Kontingen Tally)

## 1. Overview

- **Purpose & scope**: A separate, admin-configured tally page for a single,
  current one-off multi-region competition KONI Batam competes in (e.g.
  "Porprov Kepri VI") where the medal standings include **other
  Kabupaten/Kota**, not just Batam's own cabor. Distinct from
  `024-rekap-medali-tally`'s `/medali` hub, which only ever shows Batam's
  own medals filtered by tingkat/tahun — this spec adds the comparison
  dimension: how Batam stacks up against Bintan, Tanjungpinang, etc.
- **Fully manual, detached from `Prestasi`**: every kontingen's tally,
  Batam's included, is entered by hand through the admin page. There is no
  live computation from `Prestasi` records — this is a semi-detached app:
  ad-hoc multi-region competitions aren't KONI Batam's own system of record
  for any kontingen, ours included, so treating all of them the same way
  (manual entry, same table shape) keeps the data model and UI uniform
  rather than special-casing one row.
- **Only one event at a time**: there is at most one `MedaliEvent` row in
  the system. Creating a new one while one exists is rejected (`409`) — the
  admin edits or deletes the existing one first. This keeps the feature a
  simple "current event" config rather than an archive/list to maintain.
- **No "this is us" marker in the UI**: Batam's kontingen is not visually
  flagged (no badge, no "Kita" label) anywhere it's displayed — the whole
  site is already KONI Batam's own, so the public, URL, and branding already
  make that obvious; a marker would be redundant. It still sorts first and
  is protected from deletion (`isOwn` internally), just without any visible
  tag.
- **Wireframe**: user-supplied hand sketch — header naming the event, a
  "Total Perolehan Medali" hero number, a row of per-Kabupaten/Kota cards
  (Batam's own included), and below that a per-cabor medal table for
  whichever kontingen is selected.
- **Front-page visibility**: when an event is configured, the landing page
  shows a compact card identifying it (name) with Batam's own tally,
  linking to the full page — people shouldn't have to find `/medali` first.

## 2. Data Model

- **Entity**: `MedaliEvent` — the one active ad-hoc event config (at most one
  row ever exists — enforced in the service layer, not a DB constraint,
  since "zero rows" is also a valid state).
  - `id: String (uuid)`
  - `nama: String` — e.g. "Porprov Kepri VI"
  - `tingkatKejuaraan: CompetitionLevel` — reuses the existing enum (Modul F)
  - `tahun: Int`
  - `logoUrl: String?` — optional, event/competition logo
  - `createdAt`, `updatedAt`
- **Entity**: `MedaliEventKontingen` — one Kabupaten/Kota participating,
  Batam included.
  - `id: String (uuid)`
  - `medaliEventId: String` (FK → `MedaliEvent`, cascade delete)
  - `nama: String` — e.g. "Bintan" (unique per event)
  - `isOwn: Boolean @default(false)` — true for the Batam row; auto-created
    with the event (nama `"Batam"`), never visually marked (see §1), and
    undeletable (`DELETE .../kontingen/:id` returns `400` for it)
  - `createdAt`, `updatedAt`
- **Entity**: `MedaliEventKontingenTally` — one kontingen's medal count for
  one cabang olahraga.
  - `id: String (uuid)`
  - `kontingenId: String` (FK → `MedaliEventKontingen`, cascade delete)
  - `cabangOlahragaId: String` (FK → `CabangOlahraga`) — reuses KONI's own
    master sport list so columns/names line up across every kontingen
  - `gold: Int @default(0)`, `silver: Int @default(0)`, `bronze: Int @default(0)`
  - `@@unique([kontingenId, cabangOlahragaId])` — one row per cabor per
    kontingen; admin only creates a row for a cabor the kontingen actually
    won a medal in (sparse, same convention as `getRekapMedali` omitting
    zero-medal cabors).

## 3. API Contract

| Method | Path | Roles | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/medali-event` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `MedaliEvent \| null` | the current event (with `kontingen[].tallies[]`), or `null` |
| POST | `/api/v1/medali-event` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ nama, tingkatKejuaraan, tahun }` | `MedaliEvent` | `409` if one already exists; auto-creates the `isOwn` "Batam" kontingen |
| PATCH | `/api/v1/medali-event/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | partial fields | `MedaliEvent` | |
| DELETE | `/api/v1/medali-event/:id` | SUPER_ADMIN_KONI | - | `204` | cascades kontingen + their tally rows; system returns to "no event" |
| POST | `/api/v1/medali-event/:id/logo` | SUPER_ADMIN_KONI, ADMIN_KONI | multipart `file` | `{ logoUrl }` | same pattern as `POST /cabor/:id/logo` |
| POST | `/api/v1/medali-event/:id/kontingen` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ nama }` | `MedaliEventKontingen` | `nama` unique within the event (409 on dup) |
| PATCH | `/api/v1/medali-event/kontingen/:kontingenId` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ nama }` | `MedaliEventKontingen` | |
| DELETE | `/api/v1/medali-event/kontingen/:kontingenId` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `204` or `400` | `400` when `isOwn` (the Batam row can't be deleted) |
| PUT | `/api/v1/medali-event/kontingen/:kontingenId/tally/:cabangOlahragaId` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ gold, silver, bronze }` | `MedaliEventKontingenTally` or `204` | upsert — creates/overwrites the row; an all-zero body deletes it instead (sparse convention) and returns `204` |
| GET | `/api/v1/public/medali-event` | none | - | see §3.1, or `null` | single source for the `/medali/event` page **and** the landing-page card |

### 3.1 `GET /public/medali-event` response shape (`null` when none configured)

```ts
{
  event: { id, nama, tahun, tingkatKejuaraan, logoUrl },
  kontingen: Array<{
    id: string;
    nama: string;
    isOwn: boolean;         // drives sort order only — never rendered as a marker
    gold: number; silver: number; bronze: number; total: number;
    caborTally: Array<{ cabangOlahragaId, nama, gold, silver, bronze, total }>;
  }>;                       // Batam's entry always first, rest sorted by total desc
  grandTotal: number;       // sum of every kontingen's total, incl. Batam
}
```

- **Validation**: `apps/api/src/modules/medaliEvent/medaliEvent.schema.ts` —
  `createMedaliEventSchema`/`updateMedaliEventSchema` (`tahun` same
  1900–next-year bound as other report year fields), `createKontingenSchema`
  (`nama` non-empty), `tallySchema` (`gold`/`silver`/`bronze` non-negative
  ints).

## 4. UI / Pages

### Admin (dashboard)

- **Nav item "Event Medali"** → `/medali-event`. Single-config page, not a
  list:
  - **No event configured**: a form (Nama, Tingkat, Tahun) to create one —
    this also creates the Batam kontingen automatically.
  - **Event configured**:
    - Edit form for Nama/Tingkat/Tahun + logo upload (`DropZone`) + "Hapus
      Event" (`SUPER_ADMIN_KONI` only).
    - "Kabupaten & Kota" — a sortable `DataTable` (Kabupaten/Kota, Emas,
      Perak, Perunggu, Total, Aksi), one row per kontingen including Batam
      (no visual marker distinguishing it — see §1). "Tambah" opens a small
      modal for just the kontingen's nama (the one thing that still needs a
      modal, since it's a single field with no natural place to live
      inline). Each row's delete action is hidden for the Batam row.
    - **Tally editing is inline, not a modal**: clicking a kontingen row
      expands an editable tally table directly beneath it (`DataTable`'s
      `expandContent`) — existing rows' Emas/Perak/Perunggu are `<input
      type="number">` cells that save on blur (`PUT
      .../tally/:cabangOlahragaId`); a trailing row (cabor `Combobox` +
      three number inputs + a `+` button) adds a new cabor's tally directly
      into the same table. Deleting a row's icon PUTs zeros.

### Public

- **`/medali` hub** gains a compact event banner/link when one is
  configured (logo + nama + tahun + grand total → `/medali/event`); absent
  entirely when none is configured.
- **Landing page (`/`)**: the existing "Perolehan Medali" card now switches
  source when an event is configured — header shows the event's logo (if
  any) + nama instead of "Perolehan Medali", the three figures are Batam's
  own gold/silver/bronze for that event instead of the lifetime total, and
  "Detail" / each figure link to `/medali/event` instead of `/medali` /
  `/medali/:jenis`. No event configured → the card is unchanged from before
  this spec (lifetime totals, `/medali` links). No separate event banner —
  this one card covers both states.
- **`/medali/event`** — the sketch (no `:id` — there's only ever one):
  1. Header: event logo (if any) + "Perolehan Medali — `<nama>`" + tingkat
     Tahun.
  2. Hero card: "Total Perolehan Medali" — `grandTotal`.
  3. "Kabupaten & Kota" card grid — one card per kontingen, Batam always
     first but **not otherwise marked** (see §1), each showing a mini
     Emas/Perak/Perunggu readout (colored dot + count, the same convention
     `024`'s `MiniTally` already established) and its Total. Cards are
     click-toggle filters, same interaction model as `024`'s Tingkat/Tahun
     cards.
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

- Given no `MedaliEvent` exists, when `POST /medali-event`, then `201`, it
  becomes the current event, a "Batam" kontingen (`isOwn: true`) is created
  with it, and a second `POST /medali-event` returns `409` until the first
  is deleted.
- Given an admin enters `gold=2` for kontingen "Bintan" / cabor "Renang"
  (via the inline tally editor, no modal), then that kontingen's card total
  updates, and selecting its card shows "Renang" in the table.
- Given a tally cell is edited and the input loses focus, then the new
  value is saved without any extra "Simpan" click.
- Given a kontingen with zero medals entered, then `PUT
  .../tally/:caborId` with `{gold:0,silver:0,bronze:0}` deletes any existing
  row instead of leaving a 0/0/0 row.
- Given no card is selected, then the table shows every kontingen ranked by
  total descending, Batam included but visually indistinguishable from the
  others.
- Given `DELETE /medali-event/kontingen/:id` for the Batam (`isOwn`) row,
  then `400` — it cannot be deleted.
- Given no event is configured, then neither the landing page nor `/medali`
  shows any event section, and `/medali/event` shows its empty state rather
  than erroring.
- Given an event is configured, then the landing page shows its name and
  Batam's own tally without the visitor navigating anywhere first, and
  nothing on the page labels Batam as "ours" — the identification is
  implicit in the site itself.

## 7. Open Questions / Assumptions

- Other kontingens' tallies are entered **per cabor** (not one aggregate
  number) so their table matches Batam's shape exactly and the UI can reuse
  one table component — the wireframe's blank "Bintan"/"Pinang" cards (shown
  as dashes, no data yet) are consistent with either reading; per-cabor was
  chosen for UI consistency, accepting the extra admin data-entry cost.
- "Only one event at a time" is enforced as "at most one row, full stop" —
  not a date-ranged "active" flag. Running two ad-hoc events concurrently
  (unlikely for a Porprov-scale competition) is out of scope; the admin
  would delete the old one first.
- No bulk/CSV import for kontingen tallies in v1 — manual per-cabor entry
  only, consistent with how `Prestasi` itself is entered one record at a
  time.
- No PDF/Excel export for the ad-hoc event page.
- `MedaliEvent.nama` is not required to be unique beyond the singleton
  constraint itself.

## 8. Dependencies

- Depends on: `003-cabang-olahraga` (FK target for every kontingen's tally
  rows, Batam included), `024-rekap-medali-tally` (the `/medali` hub as the
  entry point, and the `MiniTally`/`RekapMedaliTable` UI conventions). Does
  **not** depend on `007-prestasi-atlet` — deliberately detached, see §1.
