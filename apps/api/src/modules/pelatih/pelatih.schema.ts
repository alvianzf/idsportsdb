import { z } from "zod";

const pelatihFields = z.object({
  namaPelatih: z.string().min(1),
  nomorLisensi: z.string().min(1),
  cabangOlahragaId: z.string().min(1),
  tingkatanLisensi: z.string().min(1),
  masaBerlakuMulai: z.coerce.date().optional(),
  masaBerlakuAkhir: z.coerce.date().optional(),
  riwayatKepelatihan: z.string().optional(),
});

function refineMasaBerlaku<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data: { masaBerlakuMulai?: Date; masaBerlakuAkhir?: Date }) =>
      !data.masaBerlakuMulai || !data.masaBerlakuAkhir || data.masaBerlakuAkhir > data.masaBerlakuMulai,
    { message: "Masa berlaku akhir harus setelah masa berlaku mulai", path: ["masaBerlakuAkhir"] },
  );
}

export const createPelatihSchema = refineMasaBerlaku(pelatihFields);
export const updatePelatihSchema = refineMasaBerlaku(pelatihFields.partial());

export const listPelatihQuerySchema = z.object({
  cabor: z.string().optional(),
  search: z.string().optional(),
  expiring: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePelatihInput = z.infer<typeof createPelatihSchema>;
export type UpdatePelatihInput = z.infer<typeof updatePelatihSchema>;
