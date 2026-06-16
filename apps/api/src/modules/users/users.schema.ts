import { z } from "zod";
import { ROLES } from "@inasportdb/shared-types";

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
