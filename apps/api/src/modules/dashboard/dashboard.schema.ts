import { z } from "zod";

export const prestasiStatsQuerySchema = z.object({
  groupBy: z.enum(["medali", "tahun", "tingkatKejuaraan"]).default("medali"),
});

const currentYear = new Date().getFullYear();

export const summaryQuerySchema = z.object({
  tahun: z.coerce.number().int().min(1950).max(currentYear + 1).optional(),
});

export type PrestasiStatsQuery = z.infer<typeof prestasiStatsQuerySchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
