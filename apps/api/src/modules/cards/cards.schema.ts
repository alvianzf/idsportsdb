import { z } from "zod";

export const issueCardSchema = z.object({
  expiresAt: z.coerce.date().optional(),
});

export const downloadCardQuerySchema = z.object({
  format: z.enum(["pdf", "png"]).default("png"),
});

export type IssueCardInput = z.infer<typeof issueCardSchema>;
