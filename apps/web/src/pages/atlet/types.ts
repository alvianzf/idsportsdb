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
  tempatLahir: string;
  tanggalLahir: string;
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
  tingkatAtlet: AthleteLevel;
  pendidikan: string | null;
  pekerjaan: string | null;
  documents?: AtletDocument[];
}
