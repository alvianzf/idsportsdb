# Spec: Master Data Atlet (Athlete Master Data)

## 1. Overview

- **Purpose & scope**: Central athlete record — biodata, sport discipline
  assignment, status/level, and supporting documents. The most central entity:
  referenced by Prestasi (007), Monitoring (008), Reports (009), and Digital
  Card (010).
- **PDF reference**: Modul B — "Master Data Atlet" (page 1)
- **Glossary**:
  - `Nomor Induk Atlet` — internal athlete ID number
  - `Nomor Registrasi Atlet` — official registration number (used on digital card)
  - `NIK` — national ID number (16-digit Indonesian ID)
  - `Status Atlet` — active/inactive/injured/training-camp/transferred
  - `Tingkat Atlet` — athlete level (pemula/daerah/provinsi/nasional/internasional)
  - Documents: `KTP`, `KK` (family card), `Akta Kelahiran` (birth certificate),
    `Pas Foto` (passport photo), `Sertifikat Prestasi` (achievement certificates)

## 2. Data Model

- **Entity**: `Atlet`
  - `id: String (uuid)`
  - `nomorIndukAtlet: String @unique`
  - `nomorRegistrasi: String @unique`
  - `namaLengkap: String`
  - `nik: String @unique` — 16 digits, validated
  - `tempatLahir: String`
  - `tanggalLahir: DateTime`
  - `jenisKelamin: Gender` (`L | P`)
  - `alamat: String`
  - `kecamatan: String?` — **added field**, see §7
  - `nomorHp: String?`
  - `email: String?`
  - `fotoUrl: String?`
  - `cabangOlahragaId: String` (FK → `CabangOlahraga`)
  - `statusAtlet: AthleteStatus @default(ACTIVE)`
  - `tingkatAtlet: AthleteLevel`
  - `pendidikan: String?`
  - `pekerjaan: String?`
  - `createdAt`, `updatedAt`
- **Entity**: `AtletDocument`
  - `id`, `atletId` (FK, cascade delete), `type: DocumentType`
    (`KTP | KK | AKTA_KELAHIRAN | PAS_FOTO | SERTIFIKAT_PRESTASI`), `fileUrl`,
    `uploadedAt`
- **Enums**: `Gender`, `AthleteStatus`, `AthleteLevel`, `DocumentType`
  (`@inasportdb/shared-types`)
- **Indexes**: unique on `nomorIndukAtlet`, `nomorRegistrasi`, `nik`; index on
  `cabangOlahragaId`, `statusAtlet`, `kecamatan`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/atlet` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | `?cabor=&status=&kecamatan=&search=&page=&pageSize=` | `{ items: Atlet[], total }` | `ADMIN_CABOR` forced to own `cabangOlahragaId` regardless of `?cabor=` |
| GET | `/api/v1/atlet/me` | ATLET | - | `Atlet` (own record, with `documents`, `prestasis`) | 404 if `req.user.athleteId` is null |
| GET | `/api/v1/atlet/:id` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor), ATLET (self only) | - | `Atlet` + `documents[]` | 403 if out of scope |
| POST | `/api/v1/atlet` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR | full `Atlet` fields (no id) | `Atlet` | `ADMIN_CABOR`: `cabangOlahragaId` forced to own; validation per §2 |
| PATCH | `/api/v1/atlet/:id` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | partial fields | `Atlet` | `ADMIN_CABOR` cannot change `cabangOlahragaId` (use Monitoring "mutasi" instead, see 008) |
| DELETE | `/api/v1/atlet/:id` | SUPER_ADMIN_KONI | - | `204` | cascades to documents/prestasi/monitoring/cards |
| POST | `/api/v1/atlet/:id/documents` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | multipart: `type`, `file` | `AtletDocument` | multer upload, stored via `lib/storage.ts` |
| GET | `/api/v1/atlet/:id/documents` | same as `GET /atlet/:id` | - | `AtletDocument[]` | |
| DELETE | `/api/v1/atlet/:id/documents/:docId` | SUPER_ADMIN_KONI, ADMIN_KONI, ADMIN_CABOR (own cabor) | - | `204` | |

- **Validation**: `apps/api/src/modules/atlet/atlet.schema.ts`
  (`createAtletSchema`, `updateAtletSchema`, `uploadDocumentSchema`) — `nik`
  exactly 16 digits, `nomorHp` numeric, `email` optional but valid if present.

## 4. UI / Pages

- **`/atlet`** — list with filters (Cabor dropdown — hidden/locked for
  `ADMIN_CABOR`, Status, Kecamatan, search by name/NIK/nomor registrasi).
  Columns: Nama, Cabor, No. Registrasi, Kecamatan, Status (`Badge`).
  "Tambah Atlet" button (DATA_ADMIN_ROLES). Bulk actions via checkbox
  selection: **Unduh Kartu** (all DATA_ADMIN_ROLES — downloads a ZIP of JPEG
  cards for selected athletes; see `010-kartu-atlet-digital`), **Hapus**
  (SUPER_ADMIN_KONI only). A non-dismissable overlay modal with an indeterminate
  progress bar and live KB counter appears during ZIP generation/download.
- **`/atlet/new`** — multi-step form: (1) Biodata (nama, NIK, tempat/tanggal
  lahir, jenis kelamin, alamat, kecamatan, kontak, pendidikan/pekerjaan), (2)
  Keanggotaan (cabor — locked for ADMIN_CABOR, nomor induk/registrasi, status,
  tingkat), (3) Dokumen (upload KTP/KK/Akta/Pas Foto — Sertifikat Prestasi
  uploaded later via Prestasi module).
- **`/atlet/:id`** — detail page with tabs: **Biodata** | **Dokumen** |
  **Prestasi** (007) | **Monitoring** (008) | **Kartu** (010). Biodata tab
  shows all fields read-only with an "Ubah" button → `/atlet/:id/edit`.
- **`/atlet/:id/edit`** — same form as `/atlet/new`, pre-filled.
- **`/me`** (ATLET role, `AtletLayout`) — read-only view of own Biodata +
  Dokumen tabs only (no Prestasi/Monitoring/Kartu tabs here — those are
  separate routes `/me/prestasi`, `/me/card`).
- **Mobile**: list → card list (photo thumbnail + name + cabor + status badge);
  multi-step form is one step per screen with a progress indicator; detail tabs
  become a horizontally-scrollable tab bar.
- **Components**: `Badge` for `statusAtlet` (success=ACTIVE, danger=INACTIVE/
  INJURED, warning=TRAINING_CAMP/TRANSFERRED), `Card`, file upload widget
  (camera/gallery picker on mobile via `<input type="file" accept="image/*">`,
  works in Capacitor webview).
- **Empty/loading/error**: skeleton rows while loading; "Belum ada atlet
  terdaftar" empty state; inline field errors from zod validation messages.

## 5. Role-Based Behavior

| Role | View | Create | Update | Delete | Scope |
|---|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ | all cabor |
| ADMIN_KONI | ✅ all | ✅ | ✅ | ❌ | all cabor |
| ADMIN_CABOR | ✅ own cabor | ✅ (own cabor) | ✅ (own cabor) | ❌ | own `cabangOlahragaId` |
| ATLET | ✅ own record only (`/me`) | ❌ | ❌ | ❌ | self |

## 6. Acceptance Criteria

- Given ADMIN_CABOR for "Atletik", when `GET /atlet?cabor=<other-cabor-id>`,
  then the response is still filtered to "Atletik" only (query param ignored
  for this role).
- Given ADMIN_CABOR for "Atletik", when `POST /atlet` with
  `cabangOlahragaId=<other-cabor-id>`, then the server overrides it to their own
  cabor (or returns `403` — pick one and document; recommend silent override
  with a warning in response metadata for v1 simplicity... **decide during
  implementation**, default = override).
- Given a duplicate `nik` or `nomorRegistrasi`, when `POST /atlet`, then `409`.
- Given an ATLET user, when `GET /atlet/me`, then 200 with their record; when
  `GET /atlet/:otherAthleteId`, then `403`.
- Given an athlete with uploaded `KTP` document, when viewing `/atlet/:id` →
  Dokumen tab, then the KTP appears with a preview/download link.

## 7. Open Questions / Assumptions

- **`kecamatan`**: not in the PDF's literal field list for Modul B, but required
  by Modul H's "data atlet per kecamatan" report. Added as an optional string
  field, recommended to be a dropdown of Batam's 12 kecamatan
  (`BATAM_KECAMATAN` in `@inasportdb/shared-types`).
- **Cross-cabor write by ADMIN_CABOR**: see acceptance criteria above — exact
  behavior (silent override vs. 403) to be confirmed during Phase 2
  implementation; default to silent override of `cabangOlahragaId`.
- **Photo (`fotoUrl`)**: stored separately from `AtletDocument` (type=
  `PAS_FOTO`) for quick display in lists/cards — `fotoUrl` is set when a
  `PAS_FOTO` document is uploaded (kept in sync by the upload handler).

## Revisi (2026-07-12)

Hasil pertemuan klien — see `specs/000-overview/revisi-2026-07-12.md`:

- **Tempat & tanggal lahir on hold**: `tempatLahir`/`tanggalLahir` become
  optional (`String?` / `DateTime?`) and are hidden from the form until the
  client confirms.
- **Data atlet inti**: foto, jenis kelamin, cabor, status atlet. `statusAtlet`
  simplified to **AKTIF / TIDAK AKTIF** only (drop INJURED/TRAINING_CAMP/
  TRANSFERRED from the form; injury/camp tracked via Monitoring 008).
- **Tingkat atlet (final)**: `AthleteLevel` = **KOTA | PROVINSI | NASIONAL |
  INTERNASIONAL** (replaces PEMULA/DAERAH/...). Editable in the atlet form;
  optional so legacy rows without a level remain valid.
- **Pendidikan terakhir**: `pendidikan` means *last education* — dropdown of
  jenjang (SD, SMP, SMA/SMK, D3, S1, S2, S3) instead of free text.
- **Data mereka input sendiri**: athletes self-input their data — the ATLET
  role gains write access to their own biodata (`PATCH /api/v1/atlet/me`);
  admin roles review/correct. Update §3 and §5 accordingly during
  implementation.
- **Bulk update**: import athletes from an uploaded **Excel/CSV** file
  (upload → validate per row → report accepted/rejected rows).
- **Bulk download**: export the (filtered) athlete list to **Excel, CSV, and
  PDF** — replaces the card-ZIP bulk action (cards canceled, see 010).

## 8. Dependencies

- Depends on: `001-auth-rbac`, `003-cabang-olahraga`. Required by:
  `007-prestasi-atlet`, `008-monitoring-atlet`, `009-pelaporan`,
  `010-kartu-atlet-digital`, `002-dashboard`. Built in Phase 2.

---

## Changelog

### DokumenTab redesigned (changed)
**File**: `apps/web/src/pages/atlet/tabs/DokumenTab.tsx`

Previous design: one `<Select>` + one upload button; users had to manually change
the select to upload different document types — non-obvious that other types existed.

New design: every document type is shown as its own row with its upload status:

- **Uploaded**: green checkmark, "Lihat berkas" link, upload date, delete button,
  "Ganti" upload button (to replace).
- **Not uploaded**: empty circle, blue-tinted "Unggah" button.
- Progress badge: "N/5 diunggah" in the card header.

Supported types (from `DOCUMENT_TYPES` in `@inasportdb/shared-types`):
| Value | Label |
|---|---|
| `KTP` | KTP |
| `KK` | Kartu Keluarga |
| `AKTA_KELAHIRAN` | Akta Kelahiran |
| `PAS_FOTO` | Pas Foto |
| `SERTIFIKAT_PRESTASI` | Sertifikat Prestasi |

No backend changes required — the API already accepts all five types.
