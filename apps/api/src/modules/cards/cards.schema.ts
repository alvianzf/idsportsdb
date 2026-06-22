import { z } from "zod";

export const issueCardSchema = z.object({
  expiresAt: z.coerce.date().optional(),
});

export const downloadCardQuerySchema = z.object({
  // "jpeg" = full card image; "png" = QR code only (legacy)
  format: z.enum(["jpeg", "png"]).default("jpeg"),
});

export const bulkDownloadBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export type IssueCardInput = z.infer<typeof issueCardSchema>;
export type BulkDownloadBody = z.infer<typeof bulkDownloadBodySchema>;
