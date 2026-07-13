# Spec: Slider Beranda (Landing-Page Photo Slider)

> Added by client revision 2026-07-12 — see `specs/000-overview/revisi-2026-07-12.md`.

## 1. Overview

- **Purpose & scope**: A full-width photo slider at the top of the public
  landing page (below the navbar, above the hero). Fully editable by
  **SUPER_ADMIN_KONI only**: upload photos, reorder, caption, show/hide,
  delete. The admin UI shows a **size guide** for uploads.

## 2. Data Model

- **Entity**: `SliderImage`
  - `id: String (uuid)`
  - `imageUrl: String` — stored via `lib/storage.ts` under `uploads/slider/`
  - `caption: String?` — overlay text
  - `linkUrl: String?` — optional click-through URL
  - `order: Int @default(0)` — display order
  - `isActive: Boolean @default(true)` — hidden slides stay stored
  - `createdAt`, `updatedAt`
- **Index**: `[isActive, order]`

## 3. API Contract

| Method | Path | Roles | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/public/slider` | public | - | active slides ordered | feeds the landing slider |
| GET | `/api/v1/slider` | SUPER_ADMIN_KONI | - | all slides | admin list |
| POST | `/api/v1/slider` | SUPER_ADMIN_KONI | multipart `file` (+`caption`) | `SliderImage` | image mime only, max 5 MB; appended last |
| PATCH | `/api/v1/slider/:id` | SUPER_ADMIN_KONI | `caption?`, `linkUrl?`, `order?`, `isActive?` | `SliderImage` | reorder = swap `order` values |
| DELETE | `/api/v1/slider/:id` | SUPER_ADMIN_KONI | - | `204` | deletes the stored file too |

Socket event `slider:change` on every mutation so the landing page updates live.

## 4. UI

- **Landing (`/`)**: full-width slider below the navbar; aspect 3:1 on
  desktop (2:1 on mobile, max height 520px), crossfade auto-advance every 5s,
  arrow buttons + dot indicators, caption overlaid on a bottom gradient.
  Renders nothing when there are no active slides.
- **Admin (`/slider`, "Slider Beranda" nav item, superadmin only)**:
  - Upload panel with **size guide**: recommended **1920 × 640 px (3:1)**,
    JPG/PNG/WebP, max 5 MB, note that edges may crop on small screens.
  - Slide list: thumbnail, inline caption edit (save on blur), active toggle
    (Tayang/Disembunyikan), up/down reorder, delete with confirmation.

## 5. Acceptance Criteria

- Given no active slides, the landing page shows no slider section.
- Given SUPER_ADMIN uploads a 6 MB file, then the upload is rejected client-side
  (and server-side by multer limits).
- Given ADMIN_KONI calls any `/api/v1/slider` endpoint, then `403`.
- Given SUPER_ADMIN toggles a slide inactive, then it disappears from the
  landing slider (live via socket) but remains in the admin list.
