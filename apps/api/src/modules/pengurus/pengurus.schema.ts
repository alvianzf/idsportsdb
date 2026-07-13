import { z } from "zod";

const pengurusFields = z.object({
  namaPengurus: z.string().min(1),
  jabatan: z.string().min(1),
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
  active: z.coerce.boolean().optional(),
});

export type CreatePengurusInput = z.infer<typeof createPengurusSchema>;
export type UpdatePengurusInput = z.infer<typeof updatePengurusSchema>;
