import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { prestasiStatsQuerySchema, summaryQuerySchema } from "./dashboard.schema.js";

export const dashboardRouter = Router();

// specs/002-dashboard/spec.md §3
dashboardRouter.use(
  authenticate,
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  scopeToCabor,
);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const caborId = req.scopedCaborId;
    const tahun = parsed.data.tahun ?? new Date().getFullYear();
    const caborFilter = caborId ? { atlet: { cabangOlahragaId: caborId } } : {};

    const [activeAtletCount, pelatihCount, caborCount, prestasiCount, prestasiCountAll] = await Promise.all([
      prisma.atlet.count({
        where: { statusAtlet: "ACTIVE", ...(caborId ? { cabangOlahragaId: caborId } : {}) },
      }),
      prisma.pelatih.count({
        where: caborId ? { cabangOlahragaId: caborId } : undefined,
      }),
      caborId ? Promise.resolve(1) : prisma.cabangOlahraga.count(),
      prisma.prestasi.count({ where: { tahun, ...caborFilter } }),
      prisma.prestasi.count({ where: caborId ? { atlet: { cabangOlahragaId: caborId } } : undefined }),
    ]);

    res.json({ activeAtletCount, pelatihCount, caborCount, prestasiCount, prestasiCountAll, tahun });
  }),
);

// Not shown to ADMIN_CABOR (single-cabor view makes this redundant).
dashboardRouter.get(
  "/stats/per-cabor",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (_req, res) => {
    const cabors = await prisma.cabangOlahraga.findMany({
      select: {
        id: true,
        nama: true,
        _count: { select: { atlets: true, pelatihs: true } },
      },
      orderBy: { nama: "asc" },
    });

    res.json(
      cabors.map((c) => ({
        cabangOlahragaId: c.id,
        nama: c.nama,
        atletCount: c._count.atlets,
        pelatihCount: c._count.pelatihs,
      })),
    );
  }),
);

dashboardRouter.get(
  "/stats/prestasi",
  asyncHandler(async (req, res) => {
    const parsed = prestasiStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const caborId = req.scopedCaborId;
    const where = caborId ? { atlet: { cabangOlahragaId: caborId } } : undefined;

    switch (parsed.data.groupBy) {
      case "tahun": {
        const groups = await prisma.prestasi.groupBy({
          by: ["tahun"],
          where,
          _count: { _all: true },
        });
        res.json(groups.map((g) => ({ key: g.tahun, count: g._count._all })));
        return;
      }
      case "tingkatKejuaraan": {
        const groups = await prisma.prestasi.groupBy({
          by: ["tingkatKejuaraan"],
          where,
          _count: { _all: true },
        });
        res.json(groups.map((g) => ({ key: g.tingkatKejuaraan, count: g._count._all })));
        return;
      }
      case "medali":
      default: {
        const groups = await prisma.prestasi.groupBy({
          by: ["medali"],
          where,
          _count: { _all: true },
        });
        res.json(groups.map((g) => ({ key: g.medali, count: g._count._all })));
        return;
      }
    }
  }),
);
