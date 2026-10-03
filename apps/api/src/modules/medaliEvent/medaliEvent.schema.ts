import { z } from "zod";
import { COMPETITION_LEVELS } from "@inasportdb/shared-types";

const MAX_YEAR = new Date().getFullYear() + 1;

export const createMedaliEventSchema = z.object({
  nama: z.string().min(1),
  tingkatKejuaraan: z.enum(COMPETITION_LEVELS),
  tahun: z.coerce.number().int().min(1900).max(MAX_YEAR),
});

export const updateMedaliEventSchema = createMedaliEventSchema.partial();

export const createKontingenSchema = z.object({
  nama: z.string().min(1),
});

export const updateKontingenSchema = createKontingenSchema;

export const tallySchema = z.object({
  gold: z.coerce.number().int().min(0),
  silver: z.coerce.number().int().min(0),
  bronze: z.coerce.number().int().min(0),
});
