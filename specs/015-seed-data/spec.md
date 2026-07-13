# Spec: Seed Data

## 1. Overview

- **Purpose**: Populate the database with realistic KONI Batam data for
  development and demonstration. All seeding is idempotent (uses upsert /
  findFirst guards) so it can be re-run safely.
- **Revisi (2026-07-12)** — see `specs/000-overview/revisi-2026-07-12.md`:
  - Seed harus mencakup **48 cabang olahraga** (bukan 8) sesuai daftar cabor
    KONI Batam.
  - **Dummy sebelum handover**: database diisi data dummy penuh (atlet,
    pelatih, pengurus per cabor) sebelum serah terima; data dummy dibersihkan
    saat go-live setelah data riil diinput.
  - `AtletCard` seeding tidak diperlukan lagi (modul kartu dibatalkan).

## 2. Running the seed

```bash
npx prisma db seed --workspace=apps/api
# or from repo root:
npm run db:seed --workspace=apps/api
```

The Prisma seed config in `apps/api/package.json`:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

## 3. Credentials

All seed users share one password, read from env:

```
SEED_PASSWORD=password123   # in .env and .env.example
```

Change before deploying to any shared or production environment.

## 4. Seed inventory

### Users (9)

| Role | Email |
|---|---|
| SUPER_ADMIN_KONI | superadmin@koni-batam.go.id |
| ADMIN_KONI | admin@koni-batam.go.id |
| ADMIN_CABOR | admincabor.atletik@koni-batam.go.id |
| ADMIN_CABOR | admincabor.renang@koni-batam.go.id |
| ADMIN_CABOR | admincabor.badminton@koni-batam.go.id |
| ADMIN_CABOR | admincabor.karate@koni-batam.go.id |
| ATLET | rizky.pratama@email.com (ATL-2021-001) |
| ATLET | oscar.f@email.com (BDM-2019-001) |
| ATLET | ulfa.n@email.com (TKD-2021-001) |
| ATLET | xandra.k@email.com (PS-2020-001) |

### Cabang Olahraga (8)
Atletik, Renang, Bulu Tangkis, Karate, Taekwondo, Pencak Silat, Bola Voli, Sepak Bola

### Pelatih (14)
1–2 per cabor, with `nomorLisensi`, `tingkatanLisensi`, `masaBerlakuMulai/Akhir`,
and `riwayatKepelatihan`.

### Pengurus Cabor (24)
3 per cabor: Ketua, Sekretaris, Bendahara. Sekretaris and Bendahara have
`reportsToId` pointing to the Ketua of the same cabor.

### Atlet (26)
3–4 per cabor. Mix of `statusAtlet` (ACTIVE, INACTIVE, INJURED, TRAINING_CAMP,
TRANSFERRED) and `tingkatAtlet` levels. Spread across Batam kecamatan.

One multi-cabor athlete: Putri Melati (Bulu Tangkis primary + Atletik via `AtletCabor`).

### Prestasi (40+)
2–3 per athlete across KOTA → INTERNASIONAL levels and all medal types including
NONE (for ranked-but-not-podium results).

### Monitoring Events (12)
Covers INJURY, MUTATION (one APPROVED), TRAINING_CAMP, SELECTION, STATUS_CHANGE
event types. All `createdById` set to the super admin seed user.

### AtletCard (11)
One active card per ACTIVE athlete, expires 2026-12-31.

### Articles (6)
5 published, 1 draft. All authored by super admin.

## 5. Known state

- **Pending mutations**: seed data has zero PENDING mutations (the one mutation
  event seeded is already APPROVED). To test the mutation approval workflow,
  create a new MUTATION monitoring event via the UI.
- **Photos/documents**: no file uploads — `fotoUrl` and document records are
  null for all seeded athletes.
- **Card QR URLs**: point to `CARD_VERIFY_BASE_URL` env value
  (default `http://localhost:5173/verify`).
