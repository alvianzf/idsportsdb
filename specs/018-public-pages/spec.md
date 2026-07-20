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

## 5. Cabor Menu (`/cabang-olahraga`)

- New navbar item **"Cabor"** in `PUBLIC_NAV` (`apps/web/src/pages/public/publicNav.ts`),
  placed after **Data**. Also added to the mobile bottom bar
  (`PublicBottomNav.tsx`) with the `Medal` lucide icon — the bar then holds
  five items (Beranda, Data, Cabor, Berita, Kalender).
- **List view** — card/grid of every cabang olahraga via
  `GET /api/v1/public/cabor`: nama cabor, logo/ikon, jumlah atlet, jumlah
  pengurus. Client-side search by nama.
- **Detail view (`/cabang-olahraga/:id`)** — clicking a cabor opens its
  **pengurus** (officials) list via `GET /api/v1/public/cabor/:id/pengurus`,
  showing **nama and jabatan** in two interchangeable, **read-only** views
  (segmented control, same pattern as `PengurusOrgViews.tsx` in `006`):
  - **Tabel** — columns Nama, Jabatan, Masa Bakti.
  - **Struktur** — top-down org chart built from `reportsToId`; boxes show
    nama + jabatan. **No drag-and-drop** (that is admin-only, see `006` §4).
- **Pengurus order** (client direction 2026-07-20) — applied server-side via
  `apps/api/src/lib/jabatanOrder.ts`, so **both the public page and the
  dashboard cabor detail** use it: Ketua Umum → Ketua Harian → Sekretaris →
  Bendahara → Ketua Bidang → Ketua Seksi → Anggota. `jabatan` is free text, so
  matching is on a normalised **prefix** ("Ketua Bidang Pembinaan" ranks as
  "Ketua Bidang"); anything unlisted sorts last, alphabetically by nama.
- **SK & Dokumen Resmi** — the cabor's `CaborDocument` rows are listed below
  the org chart; selecting one previews it **inline as a PDF** (`<iframe>`),
  with a "Buka" link for new-tab/non-PDF files.
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
| GET | `/api/v1/public/cabor/:id/pengurus` | none | `{ cabor, pengurus, dokumen }` | pengurus: `{ id, namaPengurus, jabatan, masaBaktiMulai, masaBaktiAkhir, reportsToId }` — **no `kontak`**, active terms only, jabatan-ordered; dokumen: `{ id, jenis, nomorDokumen, tanggalDokumen, fileUrl }`; `404` if the cabor is missing or inactive |
| GET | `/api/v1/public/events` | none | `Event[]` | see 017 |
| GET | `/api/v1/public/artikel` | none | `Article[]` | pre-existing |

## 7. Acceptance Criteria

- Given an anonymous visitor on `/cabang-olahraga`, when a cabor card is clicked,
  then its pengurus list opens showing nama and jabatan.
- Given the detail page, when the "Struktur" view is selected, then the org
  chart renders from `reportsToId` and no drag handles are present.
- Given an anonymous visitor, then `kontak` never appears in the
  `/api/v1/public/cabor/:id/pengurus` response.
- Given a pengurus whose `masaBaktiAkhir` is in the past, then they are not
  listed on the public page.
- Given a viewport < `md`, then "Cabor" appears in the bottom navigation.
- Given pengurus with jabatan Anggota, Ketua Umum and Sekretaris, then they are
  listed Ketua Umum → Sekretaris → Anggota on both the public and dashboard views.
- Given a cabor with an uploaded SK in PDF form, then it renders inline on the
  public detail page.
- Given an anonymous visitor on `/data`, when the athlete list loads, then no
  full athlete name appears anywhere in the API response or the UI.
- Given an athlete with prestasi at PROVINSI/GOLD and NASIONAL/SILVER, then
  the NASIONAL/SILVER one is shown as prestasi tertinggi (level outranks medal).
- Given the "Tenaga Olahraga" submenu, then coach names are shown in full.
