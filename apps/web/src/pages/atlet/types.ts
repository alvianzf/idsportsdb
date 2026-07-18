import type { AthleteLevel, AthleteStatus, DocumentType, Gender } from "@inasportdb/shared-types";

export interface CaborRef {
  id: string;
  nama: string;
}

export interface AtletDocument {
  id: string;
  type: DocumentType;
  fileUrl: string;
  uploadedAt: string;
}

export interface AtletDetail {
  id: string;
  nomorIndukAtlet: string;
  nomorRegistrasi: string;
  namaLengkap: string;
  nik: string;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  jenisKelamin: Gender;
  alamat: string;
  kecamatan: string | null;
  nomorHp: string | null;
  email: string | null;
  fotoUrl: string | null;
  cabangOlahragaId: string;
  cabangOlahraga: CaborRef;
  caborTambahan: { id: string; cabangOlahragaId: string; cabangOlahraga: CaborRef; nomorIndukAtlet: string | null; nomorRegistrasi: string | null }[];
  statusAtlet: AthleteStatus;
  tanggalCedera: string | null;
  keteranganCedera: string | null;
  tingkatAtlet: AthleteLevel | null;
  pendidikan: string | null;
  pekerjaan: string | null;
  documents?: AtletDocument[];
  // Present when this athlete already has a login account (#68).
  user?: { id: string } | null;
}
