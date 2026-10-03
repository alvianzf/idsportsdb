import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";

/** Read-only audit trail viewer — SUPER_ADMIN_KONI only (issue #69). */
export const auditRouter = Router();

auditRouter.use(authenticate, requireRole(["SUPER_ADMIN_KONI"]));

/** GET /audit/entities — distinct entity names seen so far, for the filter dropdown. */
auditRouter.get(
  "/entities",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    });
    res.json(rows.map((r) => r.entity));
  }),
);

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));

    const { userId, entity, action, from, to } = req.query as Record<string, string | undefined>;
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);

    const where: Prisma.AuditLogWhereInput = {
      ...(userId ? { userId } : {}),
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(from || to ? { createdAt } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total });
  }),
);
