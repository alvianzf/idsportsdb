import { z } from "zod";
import { ROLES } from "@inasportdb/shared-types";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

const roleScopeRefinement = (
  data: { role: string; cabangOlahragaId?: string | null; athleteId?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.role === "ADMIN_CABOR" && !data.cabangOlahragaId) {
    ctx.addIssue({
      code: "custom",
      path: ["cabangOlahragaId"],
      message: "cabangOlahragaId is required for ADMIN_CABOR",
    });
  }
  if (data.role === "ATLET" && !data.athleteId) {
    ctx.addIssue({
      code: "custom",
      path: ["athleteId"],
      message: "athleteId is required for ATLET",
    });
  }
};

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    fullName: z.string().min(1),
    // Password is now auto-generated on the server; field accepted but ignored if sent
    password: z.string().min(8).optional(),
    role: z.enum(ROLES),
    cabangOlahragaId: z.string().uuid().optional(),
    athleteId: z.string().uuid().optional(),
  })
  .superRefine(roleScopeRefinement);

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const updateUserRoleSchema = z
  .object({
    role: z.enum(ROLES),
    cabangOlahragaId: z.string().uuid().nullable().optional(),
    athleteId: z.string().uuid().nullable().optional(),
  })
  .superRefine(roleScopeRefinement);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
