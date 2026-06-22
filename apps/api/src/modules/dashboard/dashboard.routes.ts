import { Router } from "express";
import { Prisma } from "@prisma/client";
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

type SummaryRow = {
  active_atlet: bigint;
  pelatih: bigint;
  cabor: bigint;
  prestasi_tahun: bigint;
  prestasi_all: bigint;
};

async function fetchSummary(caborId: string | null | undefined, tahun: number) {
  // All 5 counts in a single round-trip to avoid repeated connection overhead
  // on a remote DB (~20ms RTT). Promise.all with separate queries multiplied
  // cold-connection cost by 5. See specs/016-indexing/spec.md §2.2.E.
  const [row] = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "Atlet"
        WHERE "statusAtlet" = 'ACTIVE'
        ${caborId ? Prisma.sql`AND "cabangOlahragaId" = ${caborId}` : Prisma.empty}
      ) AS active_atlet,
      (SELECT COUNT(*) FROM "Pelatih"
        ${caborId ? Prisma.sql`WHERE "cabangOlahragaId" = ${caborId}` : Prisma.empty}
      ) AS pelatih,
      (SELECT COUNT(*) FROM "CabangOlahraga") AS cabor,
      (SELECT COUNT(*) FROM "Prestasi"
        WHERE tahun = ${tahun}
        ${caborId ? Prisma.sql`AND "atletId" IN (SELECT id FROM "Atlet" WHERE "cabangOlahragaId" = ${caborId})` : Prisma.empty}
      ) AS prestasi_tahun,
      (SELECT COUNT(*) FROM "Prestasi"
        ${caborId ? Prisma.sql`WHERE "atletId" IN (SELECT id FROM "Atlet" WHERE "cabangOlahragaId" = ${caborId})` : Prisma.empty}
      ) AS prestasi_all
  `;
  return {
    activeAtletCount: Number(row.active_atlet),
    pelatihCount: Number(row.pelatih),
    caborCount: caborId ? 1 : Number(row.cabor),
    prestasiCount: Number(row.prestasi_tahun),
    prestasiCountAll: Number(row.prestasi_all),
    tahun,
  };
}

// specs/002-dashboard/spec.md §3 — merged endpoint: returns summary + perCabor + prestasiStats
// in one request so the frontend avoids 3 separate cold-connection round-trips.
dashboardRouter.get(
  "/all",
  asyncHandler(async (req, res) => {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const caborId = req.scopedCaborId;
    const tahun = parsed.data.tahun ?? new Date().getFullYear();
    const isUnscopedAdmin = !caborId;
    const where = caborId ? { atlet: { cabangOlahragaId: caborId } } : undefined;

    const summary = await fetchSummary(caborId, tahun);

    const [perCabor, prestasiStats] = await Promise.all([
      isUnscopedAdmin
        ? prisma.cabangOlahraga.findMany({
            select: { id: true, nama: true, _count: { select: { atlets: true, pelatihs: true } } },
            orderBy: { nama: "asc" },
          }).then((rows) =>
            rows.map((c) => ({
              cabangOlahragaId: c.id,
              nama: c.nama,
              atletCount: c._count.atlets,
              pelatihCount: c._count.pelatihs,
            }))
          )
        : Promise.resolve(null),
      prisma.prestasi.groupBy({ by: ["medali"], where, _count: { _all: true } })
        .then((groups) => groups.map((g) => ({ key: g.medali, count: g._count._all }))),
    ]);

    res.json({ summary, perCabor, prestasiStats });
  }),
);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const tahun = parsed.data.tahun ?? new Date().getFullYear();
    res.json(await fetchSummary(req.scopedCaborId, tahun));
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
