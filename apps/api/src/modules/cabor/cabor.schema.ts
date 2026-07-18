import { z } from "zod";

export const createCaborSchema = z.object({
  nama: z.string().min(1),
  ketuaCabor: z.string().optional(),
  sekretariat: z.string().optional(),
  organisasiNasional: z.string().optional(),
});

export const updateCaborSchema = createCaborSchema.partial();

// Revisi 2026-07-18: SUPER_ADMIN activate/deactivate toggle.
export const setCaborActiveSchema = z.object({
  isActive: z.boolean(),
});

export const listCaborQuerySchema = z.object({
  search: z.string().optional(),
  // Revisi 2026-07-18: ?active=true limits the list to active cabor (used by
  // create forms so new records can't target a deactivated cabor).
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

export type CreateCaborInput = z.infer<typeof createCaborSchema>;
export type UpdateCaborInput = z.infer<typeof updateCaborSchema>;
