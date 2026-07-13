import { z } from "zod";
import { COMPETITION_LEVELS, MEDALS } from "@inasportdb/shared-types";

const currentYear = new Date().getFullYear();

const prestasiFields = z.object({
  namaKejuaraan: z.string().min(1),
  tingkatKejuaraan: z.enum(COMPETITION_LEVELS),
  tahun: z.coerce.number().int().min(1950).max(currentYear + 1),
  medali: z.enum(MEDALS),
  peringkat: z.coerce.number().int().min(1).optional(),
});

// specs/007-prestasi-atlet/spec.md §3 — peringkat required when medali = NONE.
function refinePeringkat<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data: { medali?: string; peringkat?: number }) =>
      data.medali !== "NONE" || data.peringkat !== undefined,
    { message: "Peringkat wajib diisi jika medali NONE", path: ["peringkat"] },
  );
}

export const createPrestasiSchema = refinePeringkat(prestasiFields);
// Partial updates can't enforce the medali↔peringkat invariant at the schema
// level: a PATCH { medali: "NONE" } may rely on a peringkat already stored on
// the record. Keep the rule on create; leave it off the partial update schema.
export const updatePrestasiSchema = prestasiFields.partial();

export const listPrestasiQuerySchema = z.object({
  cabor: z.string().optional(),
  tahun: z.coerce.number().int().optional(),
  medali: z.enum(MEDALS).optional(),
  tingkat: z.enum(COMPETITION_LEVELS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePrestasiInput = z.infer<typeof createPrestasiSchema>;
export type UpdatePrestasiInput = z.infer<typeof updatePrestasiSchema>;
