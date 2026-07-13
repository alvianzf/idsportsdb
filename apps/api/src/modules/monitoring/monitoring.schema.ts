import { z } from "zod";
import { MONITORING_EVENT_TYPES, ATHLETE_STATUSES, MUTATION_STATUSES } from "@inasportdb/shared-types";

const createMonitoringEventFields = z.object({
  type: z.enum(MONITORING_EVENT_TYPES),
  description: z.string().optional(),
  fromValue: z.string().optional(),
  toValue: z.string().optional(),
  eventDate: z.coerce.date().optional(),
});

// specs/008-monitoring-atlet/spec.md §3 — STATUS_CHANGE.toValue must be a valid AthleteStatus.
export const createMonitoringEventSchema = createMonitoringEventFields.refine(
  (data) => data.type !== "STATUS_CHANGE" || ATHLETE_STATUSES.includes(data.toValue as never),
  { message: "toValue harus salah satu status atlet yang valid", path: ["toValue"] },
);

// mutationStatus is intentionally excluded — only settable via /monitoring/:id/mutasi.
export const updateMonitoringEventSchema = z.object({
  description: z.string().optional(),
  fromValue: z.string().optional(),
  toValue: z.string().optional(),
  eventDate: z.coerce.date().optional(),
});

export const mutasiActionSchema = z.object({
  status: z.enum(MUTATION_STATUSES),
});

export const listMonitoringQuerySchema = z.object({
  type: z.enum(MONITORING_EVENT_TYPES).optional(),
});

export const mutasiQueueQuerySchema = z.object({
  status: z.enum(MUTATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

export type CreateMonitoringEventInput = z.infer<typeof createMonitoringEventSchema>;
export type UpdateMonitoringEventInput = z.infer<typeof updateMonitoringEventSchema>;
