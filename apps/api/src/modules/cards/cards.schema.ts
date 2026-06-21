import { z } from "zod";

export const issueCardSchema = z.object({
  expiresAt: z.coerce.date().optional(),
});

export const downloadCardQuerySchema = z.object({
  // "jpeg" = full card image; "png" = QR code only (legacy)
  format: z.enum(["jpeg", "png"]).default("jpeg"),
});

export type IssueCardInput = z.infer<typeof issueCardSchema>;
