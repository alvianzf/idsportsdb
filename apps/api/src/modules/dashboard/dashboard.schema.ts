import { z } from "zod";
import { COMPETITION_LEVELS } from "@inasportdb/shared-types";

export const prestasiStatsQuerySchema = z.object({
  groupBy: z.enum(["medali", "tahun", "tingkatKejuaraan"]).default("medali"),
});

const currentYear = new Date().getFullYear();

export const summaryQuerySchema = z.object({
  tahun: z.coerce.number().int().min(1950).max(currentYear + 1).optional(),
  // Revisi 2026-08-11: filter Perolehan Medali per tingkat kejuaraan.
  tingkatKejuaraan: z.enum(COMPETITION_LEVELS).optional(),
});

export type PrestasiStatsQuery = z.infer<typeof prestasiStatsQuerySchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
