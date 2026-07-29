# Spec: Pembatasan Akses Admin Cabor (Admin Cabor Scoping)

## 1. Overview

- **Purpose & scope**: An `ADMIN_CABOR` must only see and manage the cabang
  olahraga they are responsible for. Today they can read every cabor's detail,
  pengurus list, and official documents.
- **Client request (2026-07-29)**: "admin cabor yang sekarang itu kalau setelah
  login kan dia masih bisa liat cabor lain, orang itu request buat admin cabor
  hanya bisa liat dan manage cabor yang diurusnya aja"
- **Glossary**:
  - `ADMIN_CABOR` — admin scoped to a single cabang olahraga
  - `scopedCaborId` — the cabor an ADMIN_CABOR is restricted to, set by the
    `scopeToCabor` middleware; `null` for unscoped roles

## 2. Current state

`scopeToCabor` already exists and is applied by the atlet, pelatih, prestasi,
monitoring, dashboard, and reports routers. **`caborRouter` does not apply it at
all**, so these three read endpoints are unscoped:

| Endpoint | Guard today | Leak |
| --- | --- | --- |
| `GET /cabor` | `authenticate` only | every cabor, with atlet/pelatih counts |
| `GET /cabor/:id` | `authenticate` only | any cabor's detail + pengurus list |
| `GET /cabor/:id/documents` | `authenticate` only | any cabor's SK and documents |

Writes are **not** affected: create, update, activate, delete, pengurus, and
document mutations are already restricted to `SUPER_ADMIN_KONI` / `ADMIN_KONI`,
so an ADMIN_CABOR cannot modify another cabor today. **The gap is read access.**

## 3. Rules

1. `caborRouter` applies `scopeToCabor` after `authenticate`.
2. `GET /cabor` — when `scopedCaborId` is set, return only that one cabor.
   Existing `search` and `active` filters still apply on top.
3. `GET /cabor/:id` — when `scopedCaborId` is set and `:id` differs, respond
   `403 Forbidden`. Not `404`: the cabor exists and its name is public, so
   pretending otherwise adds nothing.
4. `GET /cabor/:id/documents` — same 403 rule as (3). Documents are the
   sensitive part of a cabor record.
5. Unscoped roles (`SUPER_ADMIN_KONI`, `ADMIN_KONI`, `ADMIN_DISPORA`) are
   unchanged.

## 4. Explicit non-goals

- **Cabor names are not secret.** The public site already lists every cabor at
  `GET /api/v1/public/cabor`, including logo and athlete counts. This spec hides
  the *management view* of other cabor, not the existence of their names.
  Anywhere the dashboard needs a name-only lookup across all cabor (see §5), the
  public endpoint is the correct source.
- Pengurus and document **writes** are already KONI-only; not revisited here.
- Athlete/coach/prestasi scoping already works; not revisited here.

## 5. Known interaction — monitoring mutasi

`MonitoringPage` builds a `caborMap` from `GET /cabor` to render the destination
of a mutasi (`toValue` holds a cabor id). Once `GET /cabor` is scoped, an
ADMIN_CABOR's map no longer contains the destination cabor, and the UI falls
back to printing the raw UUID.

Fix: that display-only lookup reads from `GET /api/v1/public/cabor` instead,
which is unauthenticated and returns `{ items: [{ id, nama, ... }] }`. A mutasi
out of one's own cabor stays readable without reopening the management data.

## 6. Acceptance criteria

- As ADMIN_CABOR: `GET /cabor` returns exactly one row — their own.
- As ADMIN_CABOR: `GET /cabor/:otherId` → `403`.
- As ADMIN_CABOR: `GET /cabor/:ownId` → `200`.
- As ADMIN_CABOR: `GET /cabor/:otherId/documents` → `403`.
- As ADMIN_KONI: all of the above unchanged (`200`, full list).
- Monitoring page shows the destination cabor **name**, not a UUID, for an
  ADMIN_CABOR viewing a mutasi to another cabor.
