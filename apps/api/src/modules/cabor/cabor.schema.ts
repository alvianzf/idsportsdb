import { z } from "zod";

export const createCaborSchema = z.object({
  nama: z.string().min(1),
  ketuaCabor: z.string().optional(),
  sekretariat: z.string().optional(),
});

export const updateCaborSchema = createCaborSchema.partial();

export const listCaborQuerySchema = z.object({
  search: z.string().optional(),
});

export type CreateCaborInput = z.infer<typeof createCaborSchema>;
export type UpdateCaborInput = z.infer<typeof updateCaborSchema>;
