# Spec: Kartu Atlet Digital (Digital Athlete Card)

## 1. Overview

- **Purpose & scope**: Issues a digital ID card per athlete with a QR code
  that links to a public verification page, allowing third parties (event
  organizers, officials) to confirm an athlete's registration is genuine and
  active.
- **PDF reference**: Modul I — "Kartu Atlet Digital" (page 3)
- **Glossary**:
  - `Kartu Atlet` — athlete card
  - `Kode Kartu` (`cardCode`) — opaque unique token identifying a card
  - `QR Code` — scannable code encoding the public verify URL
  - `Cabut/Revoke` — revoke a card (invalidate without deleting history)

## 2. Data Model

- **Entity**: `AtletCard` (already defined in `prisma/schema.prisma`)
  - `id: String (uuid)`
  - `atletId: String` (FK → `Atlet`, cascade delete)
  - `cardCode: String @unique` — opaque token, generated with `nanoid` (21
    chars, URL-safe)
  - `qrPayloadUrl: String` — full URL encoded in the QR
    (`${CARD_VERIFY_BASE_URL}/verify/:cardCode`)
  - `issuedAt: DateTime @default(now())`
  - `expiresAt: DateTime?` — optional validity period
  - `isRevoked: Boolean @default(false)`
- **Relationships**: many-to-one → `Atlet` (an athlete may have multiple
  cards over time; only the latest non-revoked, non-expired one is
  "current")
- **No signed JWT**: the `cardCode` is a random opaque token, not a signed
  token — verification is a DB lookup. Simplifies revoke/reissue (no key
  rotation). See §7.

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/atlet/:atletId/card` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | - | `AtletCard \| null` (current card) | returns the latest non-revoked card, or `null` if none issued |
| POST | `/api/v1/atlet/:atletId/card` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | `{ expiresAt? }` | `AtletCard` | issues a new card: generates `cardCode` via `nanoid()`, sets `qrPayloadUrl`; does **not** auto-revoke prior cards (admin may call revoke separately) |
| POST | `/api/v1/atlet/:atletId/card/:cardId/revoke` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | - | `AtletCard` (`isRevoked=true`) | |
| GET | `/api/v1/atlet/:atletId/card/:cardId/download` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor), ATLET (self) | `?format=jpeg\|png` | binary (JPEG or PNG) | `jpeg` (default): CR80 card image at 300 dpi (1012×638 px) via `lib/cardImage.ts`; `png`: QR code only via `lib/qr.ts` |
| GET | `/api/v1/atlet/me/card` | ATLET | - | `AtletCard \| null` | self-service equivalent of the first endpoint, resolves `atletId` from `req.user.athleteId` |
| POST | `/api/v1/atlet/me/card` | ATLET | `{}` | `AtletCard` | self-service issue (if the PDF intends athletes can generate their own card — see §7) |
| GET | `/api/v1/cards/verify/:cardCode` | **public** (no auth) | - | `{ valid: boolean, athlete?: { atletId, namaLengkap, nomorIndukAtlet, cabangOlahraga, fotoUrl, statusAtlet }, reason?: "REVOKED" \| "EXPIRED" \| "NOT_FOUND" \| "INACTIVE" }` | `atletId` always included so authenticated admins can navigate to the record; no NIK/address/contact exposed |

- **Card generation logic**: `apps/api/src/modules/cards/cards.service.ts` —
  `issueCard(atletId, expiresAt?)` creates the `AtletCard` row and builds
  `qrPayloadUrl = ${env.cardVerifyBaseUrl}/verify/${cardCode}`.
- **QR rendering**: `apps/api/src/lib/qr.ts` wraps `qrcode` to produce a PNG
  buffer/data-URL from `qrPayloadUrl`.

## 4. UI / Pages

- **Kartu tab within `/atlet/:id`** (admin views) — shows current card
  (QR + details) or "Belum ada kartu" with an "Buat Kartu" button; "Cabut
  Kartu" and "Unduh PDF"/"Unduh PNG" actions when a card exists.
- **`/me/card`** (ATLET) — same card view, read-only except a "Buat Kartu"
  button if none exists yet (per §7 assumption); prominent "Unduh" button
  (useful for offline/mobile use in the webview).
- **`/verify/:cardCode`** (public, already scaffolded as
  `VerifyCardPage.tsx`) — calls `GET /cards/verify/:cardCode` on mount;
  renders:
  - **valid**: green check + athlete photo, nama, nomor induk, cabor, status
    badge ("Kartu Valid")
  - **invalid**: red/neutral state with reason ("Kartu telah dicabut" /
    "Kartu telah kedaluwarsa" / "Kartu tidak ditemukan")
- **Mobile**: card view renders as a single vertical card (photo top, QR
  below, details list); `/verify/:cardCode` is mobile-first by nature
  (scanned from a phone).
- **Components**: `Card`, `Badge` (`success`="Kartu Valid", `danger`="Tidak
  Valid"/"Dicabut", `warning`="Kedaluwarsa").

## 5. Role-Based Behavior

| Role | View | Issue | Revoke | Download |
|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ any athlete | ✅ | ✅ | ✅ |
| ADMIN_KONI | ✅ any athlete | ✅ | ✅ | ✅ |
| ADMIN_CABOR | ✅ own cabor athletes | ✅ (own cabor) | ✅ (own cabor) | ✅ |
| ATLET | ✅ own (`/me/card`) | ✅ (self, see §7) | ❌ | ✅ |
| Public | ✅ `/verify/:cardCode` only | ❌ | ❌ | ❌ |

## 6. Acceptance Criteria

- Given an athlete with no card, when `POST /atlet/:atletId/card`, then a new
  `AtletCard` is created with a unique `cardCode` and `qrPayloadUrl` pointing
  to `/verify/:cardCode`.
- Given a valid, non-revoked, non-expired card for an `ACTIVE` athlete, when
  `GET /cards/verify/:cardCode` (unauthenticated), then `valid=true` and
  minimal athlete info is returned (no NIK/address/contact fields).
- Given a revoked card, when `GET /cards/verify/:cardCode`, then
  `valid=false, reason="REVOKED"`.
- Given an unknown `cardCode`, when `GET /cards/verify/:cardCode`, then `404`
  with `valid=false, reason="NOT_FOUND"`.
- Given ADMIN_CABOR for "Atletik", when `POST /atlet/:atletId/card` for an
  athlete in a different cabor, then `403`.
- Given `?format=png` on the download endpoint, then response
  `Content-Type: image/png` containing the QR code.

## 7. Open Questions / Assumptions

- **cardCode as opaque token (not signed JWT)** — confirmed in plan: simpler
  revoke/reissue, no key management; verification is a DB lookup keyed on
  `cardCode` (already `@unique` + indexed via `@@index([atletId])` — add an
  implicit unique index on `cardCode` from `@unique`).
- **ATLET self-issue**: PDF doesn't explicitly say whether athletes can
  generate their own card or only admins issue it. Assumption: athletes
  *can* self-issue via `/me/card` (low risk — it just creates a verify
  record for their own already-approved profile), but cannot revoke (revoke
  is an admin action, e.g. if a card is lost/compromised).
- **Multiple cards per athlete**: schema allows it (no unique constraint on
  `atletId`); "current card" = latest non-revoked. Re-issuing does not
  auto-revoke the previous one — admins should explicitly revoke if needed.
  Revisit if the PDF implies "one card per athlete" strictly.
- **Expiry default**: `expiresAt` is optional/nullable — no default
  expiration period specified by the PDF; left to admin discretion per
  issuance.

## 8. Dependencies

- Depends on: `001-auth-rbac`, `004-atlet`. Built in Phase 5, after core
  athlete data exists. `qrcode` + `nanoid` packages already added to
  `apps/api/package.json`.

---

## Changelog

### Inline QR in KartuTab (added)
- `KartuTab.tsx` now renders a `QRCodeSVG` (120px, `qrcode.react`) inline beside
  card metadata — no download needed to view the QR.
- "Lihat QR" button and clicking the inline QR both open a 240px QR modal.

### verify response extended (added)
- `GET /cards/verify/:cardCode` response now includes `athlete.atletId` when
  `valid = true`, enabling `VerifyCardPage` to redirect authenticated admins
  directly to `/atlet/:atletId/rekam`.

### VerifyCardPage redirect (added)
- If viewer role is in `DATA_ADMIN_ROLES` and card is valid, redirects to
  `/atlet/:atletId/rekam` (replace) instead of showing the public verify UI.

### PDF card redesigned (changed)
- Now renders a CR80 (85.6 × 54mm) card centred on A4.
- Blue header band, athlete photo (left), name/cabor/nomor induk (right),
  QR code top-right, grey footer with card code, cut guide note below card.
