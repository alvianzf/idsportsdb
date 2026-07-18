export const GENDERS = ["L", "P"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  L: "Laki-laki",
  P: "Perempuan",
};

export const ATHLETE_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "INJURED",
  "TRAINING_CAMP",
  "TRANSFERRED",
  "RETIRED",
] as const;
export type AthleteStatus = (typeof ATHLETE_STATUSES)[number];
export const ATHLETE_STATUS_LABELS: Record<AthleteStatus, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  INJURED: "Cedera",
  TRAINING_CAMP: "TC",
  TRANSFERRED: "Mutasi",
  RETIRED: "Pensiun",
};

// Revisi 2026-07-12: tingkat atlet final — Kota/Provinsi/Nasional/Internasional.
export const ATHLETE_LEVELS = [
  "KOTA",
  "PROVINSI",
  "NASIONAL",
  "INTERNASIONAL",
  "PON",
  "OLIMPIADE",
] as const;
export type AthleteLevel = (typeof ATHLETE_LEVELS)[number];
export const ATHLETE_LEVEL_LABELS: Record<AthleteLevel, string> = {
  KOTA: "Kota",
  PROVINSI: "Provinsi",
  NASIONAL: "Nasional",
  INTERNASIONAL: "Internasional",
  PON: "PON",
  OLIMPIADE: "Olimpiade",
};

// Revisi 2026-07-12: kalender event (spec 017-event-calendar).
export const EVENT_STATUSES = ["ON_TRACK", "SELESAI", "DIBATALKAN", "DIUNDUR"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  ON_TRACK: "On Track",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
  DIUNDUR: "Diundur",
};

export const EVENT_LEVELS = [
  "KOTA_KABUPATEN",
  "PROVINSI",
  "NASIONAL",
  "INTERNASIONAL",
  "OPEN",
  "PON",
  "OLIMPIADE",
] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];
export const EVENT_LEVEL_LABELS: Record<EventLevel, string> = {
  KOTA_KABUPATEN: "Kota/Kabupaten",
  PROVINSI: "Provinsi",
  NASIONAL: "Nasional",
  INTERNASIONAL: "Internasional",
  OPEN: "Open",
  PON: "PON",
  OLIMPIADE: "Olimpiade",
};

// Revisi 2026-07-18: pendidikan terakhir picked from the client's final jenjang list.
// (Older records may hold legacy values like "S1"; forms preserve them in the select.)
export const EDUCATION_LEVELS = ["Pendidikan Tinggi", "SMA/SMK/MA/MAK", "SMP/MTs", "SD/MI"] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

// Revisi 2026-07-18 (client spec F): tingkat kejuaraan offered for new prestasi records.
export const COMPETITION_LEVEL_CHOICES = [
  "OLIMPIADE",
  "ASIAN_GAMES",
  "SEA_GAMES",
  "PON",
  "BK_PON",
  "PORWIL",
  "PORPROV",
  "PORDA",
  "POPDA",
  "PORKOT",
  "KEJURNAS",
  "KEJURDA",
  "EVENT_KHUSUS",
  "LAINNYA",
] as const;

// All valid values: the championship list plus legacy levels kept for existing rows.
export const COMPETITION_LEVELS = [
  ...COMPETITION_LEVEL_CHOICES,
  "KOTA",
  "PROVINSI",
  "NASIONAL",
  "INTERNASIONAL",
] as const;
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];
export const COMPETITION_LEVEL_LABELS: Record<CompetitionLevel, string> = {
  OLIMPIADE: "Olimpiade",
  ASIAN_GAMES: "Asian Games",
  SEA_GAMES: "SEA Games",
  PON: "PON",
  BK_PON: "BK PON (Pra PON)",
  PORWIL: "Pekan Olahraga Wilayah (Porwil)",
  PORPROV: "Pekan Olahraga Provinsi (Porprov)",
  PORDA: "Pekan Olahraga Daerah (Porda)",
  POPDA: "Pekan Olahraga Pelajar Daerah (Popda)",
  PORKOT: "Pekan Olahraga Kota (Porkot)",
  KEJURNAS: "Kejuaraan Nasional (Kejurnas)",
  KEJURDA: "Kejuaraan Daerah (Kejurda)",
  EVENT_KHUSUS: "Event Khusus",
  LAINNYA: "Lainnya",
  KOTA: "Kota",
  PROVINSI: "Provinsi",
  NASIONAL: "Nasional",
  INTERNASIONAL: "Internasional",
};

export const MEDALS = ["GOLD", "SILVER", "BRONZE", "NONE"] as const;
export type Medal = (typeof MEDALS)[number];
export const MEDAL_LABELS: Record<Medal, string> = {
  GOLD: "Emas",
  SILVER: "Perak",
  BRONZE: "Perunggu",
  NONE: "-",
};

export const DOCUMENT_TYPES = [
  "KTP",
  "KK",
  "AKTA_KELAHIRAN",
  "PAS_FOTO",
  "SERTIFIKAT_PRESTASI",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  KTP: "KTP",
  KK: "Kartu Keluarga",
  AKTA_KELAHIRAN: "Akta Kelahiran",
  PAS_FOTO: "Pas Foto",
  SERTIFIKAT_PRESTASI: "Sertifikat Prestasi",
};

/** Display label for a prestasi tingkat, preferring the custom "Lainnya" text. */
export function competitionLevelLabel(
  tingkat: CompetitionLevel,
  lainnya?: string | null,
): string {
  return tingkat === "LAINNYA" && lainnya ? lainnya : COMPETITION_LEVEL_LABELS[tingkat];
}

// Revisi 2026-07-18: tingkatan lisensi pelatih is a fixed choice (legacy
// free-text values on old records are preserved by the forms/filters).
export const LICENSE_TIERS = ["Nasional", "Cabang Olahraga"] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

export const MONITORING_EVENT_TYPES = [
  "INJURY",
  "MUTATION",
  "TRAINING_CAMP",
  "SELECTION",
  "STATUS_CHANGE",
] as const;
export type MonitoringEventType = (typeof MONITORING_EVENT_TYPES)[number];
export const MONITORING_EVENT_TYPE_LABELS: Record<MonitoringEventType, string> = {
  INJURY: "Cedera",
  MUTATION: "Mutasi Atlet",
  TRAINING_CAMP: "TC",
  SELECTION: "Seleksi Atlet",
  STATUS_CHANGE: "Perubahan Status",
};

export const MUTATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type MutationStatus = (typeof MUTATION_STATUSES)[number];
export const MUTATION_STATUS_LABELS: Record<MutationStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

/** Batam's 12 kecamatan, used as a fixed dropdown for Atlet.kecamatan. */
export const BATAM_KECAMATAN = [
  "Batu Ampar",
  "Lubuk Baja",
  "Sekupang",
  "Nongsa",
  "Sei Beduk",
  "Batam Kota",
  "Bengkong",
  "Sagulung",
  "Belakang Padang",
  "Bulang",
  "Galang",
  "Batu Aji",
] as const;
export type BatamKecamatan = (typeof BATAM_KECAMATAN)[number];
