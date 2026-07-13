import { z } from "zod";

export const createArtikelSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  published: z.boolean().optional(),
});

export const updateArtikelSchema = createArtikelSchema.partial();

export const listArtikelQuerySchema = z.object({
  search: z.string().optional(),
  published: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

export const publicArtikelQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export type CreateArtikelInput = z.infer<typeof createArtikelSchema>;
export type UpdateArtikelInput = z.infer<typeof updateArtikelSchema>;
