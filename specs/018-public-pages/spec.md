# Spec: Halaman Publik (Public Landing Menus)

> Added by client revision 2026-07-12 — see `specs/000-overview/revisi-2026-07-12.md`.

## 1. Overview

- **Purpose & scope**: Public (no-auth) pages reachable from the landing-page
  navbar: **Data** (athlete data + statistics, with a **Tenaga Olahraga**
  submenu for coaches), **Berita** (published articles), and **Kalender Event**
  (see `017-event-calendar`). Includes the landing-page redesign.

## 2. Landing Page (`/`)

- Redesigned per client direction: bold look, **sharp colors and gradients
  (no pastel)**, detailed styling, **framer-motion** entrance animations.
- Sticky navbar with menus: **Data**, **Berita**, **Kalender Event**, plus
  Masuk/Dashboard button.
- Sections: hero (red gradient), stat cards (atlet aktif, cabor, pelatih,
  total medali), perolehan medali, Kalender Event preview (4 latest, live via
  socket `event:change`), Berita preview (6 latest).

## 3. Data Menu (`/data`)

- Shows statistics (same source as landing stats) and athlete data.
- **Athlete names are censored** with `**` (first 2 letters kept per word,
  e.g. "Rizky Pratama" → "Ri** Pr**"). Censoring happens **server-side**
  (`GET /api/v1/public/atlet`) so real names never leave the API.
- Each athlete row shows: nama (censored), cabor, jenis kelamin, tingkat,
  status, and **prestasi tertinggi** (highest by tingkat kejuaraan →
  medali → tahun).
- **Submenu "Tenaga Olahraga"**: coach data via `GET /api/v1/public/pelatih` —
  **names NOT censored** (client decision). Columns: nama, cabor, tingkatan
  lisensi, masa berlaku.
- Both lists paginated (20/page, max 50).

## 4. Berita Menu (`/berita`)

- Own navbar item on the landing page. Lists published articles (card grid,
  same style as landing preview) via `GET /api/v1/public/artikel?limit=60`;
  cards link to the existing `/artikel/:slug` public detail page.

## 5. Cabor Menu (`/cabor-publik`)

- New navbar item **"Cabor"** in `PUBLIC_NAV` (`apps/web/src/pages/public/publicNav.ts`),
  placed after **Data**. Also added to the mobile bottom bar
  (`PublicBottomNav.tsx`) with the `Medal` lucide icon — the bar then holds
  five items (Beranda, Data, Cabor, Berita, Kalender).
- **List view** — card/grid of every cabang olahraga via
  `GET /api/v1/public/cabor`: nama cabor, logo/ikon, jumlah atlet, jumlah
  pengurus. Client-side search by nama.
- **Detail view (`/cabor-publik/:id`)** — clicking a cabor opens its
  **pengurus** (officials) list via `GET /api/v1/public/cabor/:id/pengurus`,
  showing **nama and jabatan** in two interchangeable, **read-only** views
  (segmented control, same pattern as `PengurusOrgViews.tsx` in `006`):
  - **Tabel** — columns Nama, Jabatan, Masa Bakti.
  - **Struktur** — top-down org chart built from `reportsToId`; boxes show
    nama + jabatan. **No drag-and-drop** (that is admin-only, see `006` §4).
- Contact info (`kontak`) is **not exposed** publicly.
- Both endpoints are anonymous; pengurus are filtered to **active terms only**
  (`masaBaktiAkhir >= today`).
- **Empty states**: "Belum ada cabang olahraga" / "Belum ada pengurus terdaftar".

## 6. API Contract

| Method | Path | Auth | Response | Notes |
|---|---|---|---|---|
| GET | `/api/v1/public/atlet` | none | `{ items, total }` | names censored server-side; includes `prestasiTertinggi` |
| GET | `/api/v1/public/pelatih` | none | `{ items, total }` | names uncensored |
| GET | `/api/v1/public/cabor` | none | `{ items, total }` | includes `jumlahAtlet`, `jumlahPengurus` |
| GET | `/api/v1/public/cabor/:id/pengurus` | none | `PengurusPublik[]` | `{ id, namaPengurus, jabatan, masaBaktiMulai, masaBaktiAkhir, reportsToId }` — **no `kontak`**; active terms only |
| GET | `/api/v1/public/events` | none | `Event[]` | see 017 |
| GET | `/api/v1/public/artikel` | none | `Article[]` | pre-existing |

## 7. Acceptance Criteria

- Given an anonymous visitor on `/cabor-publik`, when a cabor card is clicked,
  then its pengurus list opens showing nama and jabatan.
- Given the detail page, when the "Struktur" view is selected, then the org
  chart renders from `reportsToId` and no drag handles are present.
- Given an anonymous visitor, then `kontak` never appears in the
  `/api/v1/public/cabor/:id/pengurus` response.
- Given a pengurus whose `masaBaktiAkhir` is in the past, then they are not
  listed on the public page.
- Given a viewport < `md`, then "Cabor" appears in the bottom navigation.
- Given an anonymous visitor on `/data`, when the athlete list loads, then no
  full athlete name appears anywhere in the API response or the UI.
- Given an athlete with prestasi at PROVINSI/GOLD and NASIONAL/SILVER, then
  the NASIONAL/SILVER one is shown as prestasi tertinggi (level outranks medal).
- Given the "Tenaga Olahraga" submenu, then coach names are shown in full.
