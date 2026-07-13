import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";

/** Read-only audit trail viewer — SUPER_ADMIN_KONI only (issue #69). */
export const auditRouter = Router();

auditRouter.use(authenticate, requireRole(["SUPER_ADMIN_KONI"]));

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ items, total });
  }),
);
