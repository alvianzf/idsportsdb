import { z } from "zod";
import { JABATAN_PENGURUS } from "@inasportdb/shared-types";

const pengurusFields = z.object({
  namaPengurus: z.string().min(1),
  jabatan: z.enum(JABATAN_PENGURUS),
  // Unit name for KETUA_BIDANG/KETUA_SEKSI/ANGGOTA; free-text label for LAINNYA.
  bidang: z.string().trim().min(1).nullable().optional(),
  masaBaktiMulai: z.coerce.date(),
  masaBaktiAkhir: z.coerce.date(),
  kontak: z.string().optional(),
  reportsToId: z.string().uuid().nullable().optional(),
});

function refineMasaBakti<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data: { masaBaktiMulai?: Date; masaBaktiAkhir?: Date }) =>
      !data.masaBaktiMulai || !data.masaBaktiAkhir || data.masaBaktiAkhir > data.masaBaktiMulai,
    { message: "Masa bakti akhir harus setelah masa bakti mulai", path: ["masaBaktiAkhir"] },
  );
}

export const createPengurusSchema = refineMasaBakti(pengurusFields);
export const updatePengurusSchema = refineMasaBakti(pengurusFields.partial());

export const listPengurusQuerySchema = z.object({
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

export const swapPengurusSchema = z.object({
  aId: z.string().uuid(),
  bId: z.string().uuid(),
});

export type CreatePengurusInput = z.infer<typeof createPengurusSchema>;
export type UpdatePengurusInput = z.infer<typeof updatePengurusSchema>;
