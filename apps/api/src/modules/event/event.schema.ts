import { z } from "zod";
import { EVENT_LEVELS, EVENT_STATUSES } from "@inasportdb/shared-types";

export const createEventSchema = z.object({
  namaKejuaraan: z.string().min(1),
  tingkat: z.enum(EVENT_LEVELS),
  lokasi: z.string().optional(),
  deskripsi: z.string().optional(),
  tanggalMulai: z.coerce.date(),
  tanggalSelesai: z.coerce.date().optional(),
  cabangOlahragaId: z.string().optional(),
  status: z.enum(EVENT_STATUSES).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const listEventQuerySchema = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  cabor: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(2000).default(2000),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
