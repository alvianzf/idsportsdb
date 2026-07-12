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
] as const;
export type AthleteStatus = (typeof ATHLETE_STATUSES)[number];
export const ATHLETE_STATUS_LABELS: Record<AthleteStatus, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  INJURED: "Cedera",
  TRAINING_CAMP: "TC",
  TRANSFERRED: "Mutasi",
};

// Revisi 2026-07-12: tingkat atlet final — Kota/Provinsi/Nasional/Internasional.
export const ATHLETE_LEVELS = [
  "KOTA",
  "PROVINSI",
  "NASIONAL",
  "INTERNASIONAL",
] as const;
export type AthleteLevel = (typeof ATHLETE_LEVELS)[number];
export const ATHLETE_LEVEL_LABELS: Record<AthleteLevel, string> = {
  KOTA: "Kota",
  PROVINSI: "Provinsi",
  NASIONAL: "Nasional",
  INTERNASIONAL: "Internasional",
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
] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];
export const EVENT_LEVEL_LABELS: Record<EventLevel, string> = {
  KOTA_KABUPATEN: "Kota/Kabupaten",
  PROVINSI: "Provinsi",
  NASIONAL: "Nasional",
  INTERNASIONAL: "Internasional",
  OPEN: "Open",
};

// Revisi 2026-07-12: pendidikan = pendidikan terakhir, picked from a fixed jenjang list.
export const EDUCATION_LEVELS = ["SD", "SMP", "SMA/SMK", "D3", "S1", "S2", "S3"] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const COMPETITION_LEVELS = [
  "KOTA",
  "PROVINSI",
  "NASIONAL",
  "INTERNASIONAL",
] as const;
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];
export const COMPETITION_LEVEL_LABELS: Record<CompetitionLevel, string> = {
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
