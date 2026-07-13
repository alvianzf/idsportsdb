import { z } from "zod";
import { GENDERS, ATHLETE_STATUSES, ATHLETE_LEVELS, DOCUMENT_TYPES } from "@inasportdb/shared-types";
import { canonicalIdentifier } from "../../lib/identifiers.js";

export const createAtletSchema = z.object({
  // Identifiers are canonicalized on write (trim + strip whitespace + uppercase)
  // so the DB @unique constraint bars formatting-variant duplicates everywhere.
  nomorIndukAtlet: z.string().trim().min(1).transform(canonicalIdentifier),
  nomorRegistrasi: z.string().trim().min(1).transform(canonicalIdentifier),
  namaLengkap: z.string().min(1),
  nik: z.string().regex(/^\d{16}$/, "NIK harus 16 digit angka"),
  // Revisi 2026-07-12: tempat/tanggal lahir on hold — optional.
  tempatLahir: z.string().optional(),
  tanggalLahir: z.coerce.date().optional(),
  jenisKelamin: z.enum(GENDERS),
  alamat: z.string().min(1),
  kecamatan: z.string().optional(),
  nomorHp: z.string().regex(/^\d+$/, "Nomor HP harus berupa angka").optional(),
  email: z.string().email().optional(),
  cabangOlahragaId: z.string().min(1),
  statusAtlet: z.enum(ATHLETE_STATUSES).optional(),
  // Revisi 2026-07-12: tingkat atlet TBD — optional.
  tingkatAtlet: z.enum(ATHLETE_LEVELS).optional(),
  pendidikan: z.string().optional(),
  pekerjaan: z.string().optional(),
  /** Additional cabor with optional per-cabor registration numbers. */
  cabangOlahragaLain: z
    .array(
      z.object({
        cabangOlahragaId: z.string().min(1),
        // Keep the original optional/empty semantics; canonicalize when present.
        nomorIndukAtlet: z.string().transform(canonicalIdentifier).optional(),
        nomorRegistrasi: z.string().transform(canonicalIdentifier).optional(),
      }),
    )
    .optional(),
});

export const updateAtletSchema = createAtletSchema.partial();

// Revisi 2026-07-12: athletes self-input their own biodata (PATCH /atlet/me).
// Identity/membership fields (NIK, nomor induk/registrasi, cabor, status) stay admin-only.
export const updateAtletMeSchema = z.object({
  namaLengkap: z.string().min(1).optional(),
  jenisKelamin: z.enum(GENDERS).optional(),
  alamat: z.string().min(1).optional(),
  kecamatan: z.string().optional(),
  nomorHp: z.string().regex(/^\d+$/, "Nomor HP harus berupa angka").optional(),
  email: z.string().email().optional(),
  pendidikan: z.string().optional(),
  pekerjaan: z.string().optional(),
});

export const listAtletQuerySchema = z.object({
  cabor: z.string().optional(),
  status: z.enum(ATHLETE_STATUSES).optional(),
  kecamatan: z.string().optional(),
  search: z.string().optional(),
  // #70 — when true, list the soft-deleted (archived) athletes instead of live ones.
  deleted: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const uploadDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
});

export type CreateAtletInput = z.infer<typeof createAtletSchema>;
export type UpdateAtletInput = z.infer<typeof updateAtletSchema>;
export type ListAtletQuery = z.infer<typeof listAtletQuerySchema>;
