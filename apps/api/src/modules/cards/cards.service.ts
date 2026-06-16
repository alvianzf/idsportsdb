import { nanoid } from "nanoid";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

// specs/010-kartu-atlet-digital/spec.md §3 — cardCode is an opaque token, not a signed JWT.
export function issueCard(atletId: string, expiresAt?: Date) {
  const cardCode = nanoid();
  const qrPayloadUrl = `${env.cardVerifyBaseUrl}/${cardCode}`;
  return prisma.atletCard.create({
    data: { atletId, cardCode, qrPayloadUrl, expiresAt },
  });
}

export function getCurrentCard(atletId: string) {
  return prisma.atletCard.findFirst({
    where: { atletId, isRevoked: false },
    orderBy: { issuedAt: "desc" },
  });
}
