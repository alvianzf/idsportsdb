import { z } from "zod";

// Optional text field that can also be cleared — the form sends null for an
// empty input, which Prisma writes back as NULL.
const clearableText = z.string().trim().nullable().optional();

export const createCaborSchema = z.object({
  nama: z.string().min(1),
  ketuaCabor: clearableText,
  // Revisi 2026-07-27: data sekretariat — `sekretariat` menyimpan alamatnya.
  sekretariat: clearableText,
  teleponSekretariat: clearableText,
  emailSekretariat: clearableText,
  narahubungSekretariat: clearableText,
  organisasiNasional: clearableText,
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
