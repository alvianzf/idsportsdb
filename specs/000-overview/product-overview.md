# Product Overview — KONI Batam Web App

## Vision

A web-based information system for **KONI Batam** (Komite Olahraga Nasional Indonesia,
Batam chapter) to manage athletes, coaches, sport disciplines, achievements, and
reporting — replacing manual/paper-based record keeping. Delivered as a mobile-first
SPA so it can later be wrapped for Android/iOS via Capacitor webview.

Source requirements: `KONI-Batam_WebApp.pdf` (root of this repo).

## Personas / Roles

| Role | Indonesian | Summary |
|---|---|---|
| `SUPER_ADMIN_KONI` | Super Admin KONI | Manages the entire system, all users, sees all reports |
| `ADMIN_KONI` | Admin KONI | Inputs/updates data across all cabor, manages reports |
| `ADMIN_CABOR` | Admin Cabang Olahraga | Manages athlete/coach data for their own sport discipline only |
| `ATLET` | Atlet | Views own profile, downloads own digital athlete card |

## Modules (PDF → spec mapping)

| PDF Module | English | Spec |
|---|---|---|
| A. Dashboard Utama | Main dashboard | `002-dashboard` |
| B. Master Data Atlet | Athlete master data | `004-atlet` |
| C. Data Pelatih | Coach data | `005-pelatih` |
| D. Data Pengurus Cabor | Sport branch officials | `006-pengurus-cabor` |
| E. Data Cabang Olahraga | Sport discipline master data | `003-cabang-olahraga` |
| F. Data Prestasi Atlet | Athlete achievements | `007-prestasi-atlet` |
| G. Monitoring Atlet | Athlete monitoring | `008-monitoring-atlet` |
| H. Pelaporan | Reporting | `009-pelaporan` |
| I. Kartu Atlet Digital | Digital athlete card | `010-kartu-atlet-digital` |

Auth/RBAC (`001-auth-rbac`) underlies all of the above and is built first.

## Glossary (Indonesian ↔ English)

| Indonesian | English |
|---|---|
| Atlet | Athlete |
| Pelatih | Coach |
| Cabang Olahraga (Cabor) | Sport discipline / sport branch |
| Pengurus Cabor | Sport branch officials/board |
| Prestasi | Achievement |
| Kejuaraan | Competition / championship |
| Medali | Medal |
| Peringkat | Ranking |
| Cedera | Injury |
| Mutasi | Transfer (between cabor/region) |
| Pemusatan Latihan | Centralized training camp |
| Seleksi Atlet | Athlete selection |
| Nomor Induk Atlet | Athlete ID number |
| Nomor Registrasi Atlet | Athlete registration number |
| NIK | National ID number (Nomor Induk Kependudukan) |
| KTP | National ID card |
| KK | Family card (Kartu Keluarga) |
| Akta Kelahiran | Birth certificate |
| Kecamatan | Sub-district |
| Kartu Atlet Digital | Digital athlete card |
| Lisensi | License |
| Masa Berlaku / Masa Bakti | Validity period / term of service |

## Spec-Driven Development

Each module is specified in `specs/<NNN-name>/spec.md` following
`specs/_template/spec-template.md` **before** implementation. A spec's
"API Contract" and "Data Model" sections are the source of truth for the
Prisma schema (`apps/api/prisma/schema.prisma`), Express routes, and the
frontend API client/pages.
