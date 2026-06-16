import { z } from "zod";
import { GENDERS, ATHLETE_STATUSES, ATHLETE_LEVELS, DOCUMENT_TYPES } from "@inasportdb/shared-types";

export const createAtletSchema = z.object({
  nomorIndukAtlet: z.string().min(1),
  nomorRegistrasi: z.string().min(1),
  namaLengkap: z.string().min(1),
  nik: z.string().regex(/^\d{16}$/, "NIK harus 16 digit angka"),
  tempatLahir: z.string().min(1),
  tanggalLahir: z.coerce.date(),
  jenisKelamin: z.enum(GENDERS),
  alamat: z.string().min(1),
  kecamatan: z.string().optional(),
  nomorHp: z.string().regex(/^\d+$/, "Nomor HP harus berupa angka").optional(),
  email: z.string().email().optional(),
  cabangOlahragaId: z.string().min(1),
  statusAtlet: z.enum(ATHLETE_STATUSES).optional(),
  tingkatAtlet: z.enum(ATHLETE_LEVELS),
  pendidikan: z.string().optional(),
  pekerjaan: z.string().optional(),
  /** Additional cabor with optional per-cabor registration numbers. */
  cabangOlahragaLain: z
    .array(
      z.object({
        cabangOlahragaId: z.string().min(1),
        nomorIndukAtlet: z.string().optional(),
        nomorRegistrasi: z.string().optional(),
      }),
    )
    .optional(),
});

export const updateAtletSchema = createAtletSchema.partial();

export const listAtletQuerySchema = z.object({
  cabor: z.string().optional(),
  status: z.enum(ATHLETE_STATUSES).optional(),
  kecamatan: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const uploadDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
});

export type CreateAtletInput = z.infer<typeof createAtletSchema>;
export type UpdateAtletInput = z.infer<typeof updateAtletSchema>;
export type ListAtletQuery = z.infer<typeof listAtletQuerySchema>;
