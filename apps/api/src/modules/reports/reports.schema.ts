import { z } from "zod";
import { COMPETITION_LEVELS, MEDALS } from "@inasportdb/shared-types";

export const reportFormatSchema = z.enum(["json", "pdf", "excel"]).default("json");

export const baseReportQuerySchema = z.object({ format: reportFormatSchema });

export const atletPerUsiaQuerySchema = z.object({
  format: reportFormatSchema,
  bucket: z.coerce.number().int().min(1).max(50).default(5),
});

export const pelatihReportQuerySchema = z.object({
  format: reportFormatSchema,
  cabor: z.string().optional(),
});

export const prestasiReportQuerySchema = z.object({
  format: reportFormatSchema,
  tahun: z.coerce.number().int().optional(),
  tingkat: z.enum(COMPETITION_LEVELS).optional(),
  medali: z.enum(MEDALS).optional(),
});

export const rekapMedaliQuerySchema = z.object({
  format: reportFormatSchema,
  tahun: z.coerce.number().int().optional(),
  cabor: z.string().optional(),
});
