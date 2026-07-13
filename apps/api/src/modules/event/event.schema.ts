import { z } from "zod";
import { EVENT_LEVELS, EVENT_STATUSES } from "@inasportdb/shared-types";

const eventFields = z.object({
  namaKejuaraan: z.string().min(1),
  tingkat: z.enum(EVENT_LEVELS),
  lokasi: z.string().optional(),
  deskripsi: z.string().optional(),
  tanggalMulai: z.coerce.date(),
  tanggalSelesai: z.coerce.date().optional(),
  cabangOlahragaId: z.string().optional(),
  status: z.enum(EVENT_STATUSES).optional(),
});

function refineTanggal<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data: { tanggalMulai?: Date; tanggalSelesai?: Date }) =>
      !data.tanggalMulai || !data.tanggalSelesai || data.tanggalSelesai >= data.tanggalMulai,
    { message: "Tanggal selesai harus sama dengan atau setelah tanggal mulai", path: ["tanggalSelesai"] },
  );
}

export const createEventSchema = refineTanggal(eventFields);

export const updateEventSchema = refineTanggal(eventFields.partial());

export const listEventQuerySchema = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  cabor: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
