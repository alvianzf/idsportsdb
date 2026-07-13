import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Records an audit-trail row for a mutation (issue #69). Fire-and-forget: a
 * logging failure must never break the request that triggered it, so the write
 * is not awaited and any error is only logged.
 */
export function writeAudit(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  changes?: Prisma.InputJsonValue,
): void {
  prisma.auditLog
    .create({ data: { userId, action, entity, entityId, changes } })
    .catch((err) =>
      console.error(`[audit] failed to write ${action} ${entity} ${entityId}:`, err?.message ?? err),
    );
}
