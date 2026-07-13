# Spec: Rekam Atlet (Athlete Record Page)

## 1. Overview

- **Purpose & scope**: A full-screen, mobile-first athlete profile page that surfaces
  the most important information at a glance — name, photo, QR code, stats, prestasi,
  and full biodata on a single scrollable page. Accessible to all authenticated users.
  Designed to be the landing destination when an admin scans an athlete's digital card QR.

- **Glossary**:
  - `Rekam Atlet` — Athlete record / profile page
  - `Kartu Atlet Digital` — Digital athlete card (QR-based)

## 2. Data Model

No new database models. This page aggregates data from existing models:

- `Atlet` — name, photo, biodata
- `AtletCard` — active card & QR payload URL
- `Prestasi` — achievement list

### Backend change

`GET /api/v1/cards/verify/:cardCode` — response extended:

```json
{
  "valid": true,
  "athlete": {
    "atletId": "string",        // ← NEW: enables redirect to record page
    "namaLengkap": "string",
    "nomorIndukAtlet": "string",
    "cabangOlahraga": { "id": "string", "nama": "string" },
    "fotoUrl": "string | null",
    "statusAtlet": "AthleteStatus"
  }
}
```

## 3. API Contract

All endpoints are existing — no new routes added.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/atlet/:id` | All roles | Athlete biodata |
| GET | `/api/v1/atlet/:id/card` | Admin roles | Active card for admin view |
| GET | `/api/v1/atlet/me/card` | ATLET | Active card for self-view |
| GET | `/api/v1/atlet/:id/prestasi` | All roles | Achievements list |
| GET | `/api/v1/cards/verify/:cardCode` | Public | Extended to include `atletId` |

### QR scan → record page redirect

`VerifyCardPage` (`/verify/:cardCode`):
- Calls `GET /cards/verify/:cardCode`
- If `valid === true` **and** the viewer's role is in `DATA_ADMIN_ROLES` → navigate to
  `/atlet/:atletId/rekam` (replace)
- Otherwise → show existing public verification UI

## 4. UI / Pages

### Athlete Record Page

- **Route**: `/atlet/:id/rekam` — registered **outside** `AppLayout` (full-screen, no
  sidebar/bottom nav/header shell)
- **File**: `apps/web/src/pages/atlet/AtletRecordPage.tsx`
- **Auth**: Page checks `useAuthStore`. Redirects to `/login` if unauthenticated.

### Layout (top → bottom, mobile-first)

```
┌─────────────────────────────────┐
│ ← Kembali        [QR thumbnail] │  ← sticky header bar (h-14, bg-white, border-b)
├─────────────────────────────────┤
│         Nama Lengkap (h1)       │
│         Cabang Olahraga         │  ← profile card, bg-white
│         [Circular photo 112px]  │
│  [badge status] [level] [gender]│
├─────────────────────────────────┤
│ No. Induk │ No. Registrasi      │  ← stats grid (2-col mobile, 3-col sm+)
│ Tgl Lahir │ Tempat Lahir        │    gap-px tiles on bg-neutral-200
│ Kecamatan │ No. HP              │
│ Kartu: Aktif  [Lihat QR btn]    │  ← span-2 on mobile if card exists
├─────────────────────────────────┤
│ PRESTASI                        │  ← section header (xs uppercase tracking-widest)
│ • [name] [year] [level] [medal] │
│ • ...                           │
├─────────────────────────────────┤
│ INFORMASI LENGKAP               │
│ NIK       │ value               │
│ Alamat    │ value               │
│ ...                             │
└─────────────────────────────────┘
```

- **No gradients**: Hero uses flat `bg-white`, neutral borders.
- **Full-screen mobile**: Route outside AppLayout; safe-area insets applied.
- **QR modal**: Clicking the thumbnail opens `<Modal>` with 240px `<QRCodeSVG>` and
  athlete name + URL below it.

### KartuTab enhancement

- **File**: `apps/web/src/pages/atlet/tabs/KartuTab.tsx`
- Added `qrcode.react` (`QRCodeSVG`) inline display (120px) beside card metadata.
- Added "Lihat QR" button (`<Maximize2>`) in action row.
- QR modal (240px) shows on click, no download required.
- Package: `qrcode.react ^4.2.0` added to `apps/web`.

### AtletDetailPage enhancement

- **File**: `apps/web/src/pages/atlet/AtletDetailPage.tsx`
- Added "Rekam Atlet" button (`<ScanLine>` icon) linking to `/atlet/:id/rekam`.
- Visible to all users viewing the detail page.

## 5. Role-Based Behavior

| Role | Access to `/atlet/:id/rekam` | QR scan redirects here? |
|---|---|---|
| SUPER_ADMIN_KONI | Yes (full biodata) | Yes |
| ADMIN_KONI | Yes | Yes |
| ADMIN_CABOR | Yes (own cabor only, enforced by existing atlet API) | Yes |
| ATLET | Yes — own record only (`user.athleteId === id`) | No (public verify page shown) |

> Athlete card path: if `user.role === "ATLET" && user.athleteId === id`, fetches
> `/atlet/me/card` instead of `/atlet/:id/card`.

## 6. Dependencies Added

| Package | Location | Version | Purpose |
|---|---|---|---|
| `qrcode.react` | `apps/web` | `^4.2.0` | Render QR SVG client-side without API call |
