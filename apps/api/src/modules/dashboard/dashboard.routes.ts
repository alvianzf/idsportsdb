import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { summaryQuerySchema } from "./dashboard.schema.js";

export const dashboardRouter = Router();

// specs/002-dashboard/spec.md §3
dashboardRouter.use(
  authenticate,
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA"]),
  scopeToCabor,
);

type DashboardRow = {
  active_atlet: bigint;
  pelatih: bigint;
  cabor: bigint;
  prestasi_tahun: bigint;
  prestasi_all: bigint;
  per_cabor: Array<{
    id: string;
    nama: string;
    logo_organisasi_url: string | null;
    atlet_count: string;
    pelatih_count: string;
    gold_count: string;
    silver_count: string;
    bronze_count: string;
  }> | null;
  prestasi_stats: Array<{ medali: string; cnt: string }> | null;
};

// All dashboard data in one SQL round-trip. Prisma groupBy and findMany+_count each
// open new connections on a remote DB (~100–500ms cold overhead each). A single
// $queryRaw with correlated subqueries and json_agg eliminates that entirely.
// See specs/002-dashboard/spec.md §3.2 and specs/016-indexing/spec.md.
async function fetchAll(caborId: string | null | undefined, tahun: number) {
  // #70 — exclude soft-deleted rows from every count.
  const atletCaborFilter = caborId
    ? Prisma.sql`AND "cabangOlahragaId" = ${caborId}`
    : Prisma.empty;
  const pelatihCaborFilter = caborId
    ? Prisma.sql`AND "cabangOlahragaId" = ${caborId}`
    : Prisma.empty;
  const prestasiCaborFilter = caborId
    ? Prisma.sql`AND "atletId" IN (SELECT id FROM "Atlet" WHERE "deletedAt" IS NULL AND "cabangOlahragaId" = ${caborId})`
    : Prisma.sql`AND "atletId" IN (SELECT id FROM "Atlet" WHERE "deletedAt" IS NULL)`;

  const [row] = await prisma.$queryRaw<DashboardRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "Atlet"
        WHERE "statusAtlet" = 'ACTIVE' AND "deletedAt" IS NULL ${atletCaborFilter}
      ) AS active_atlet,
      (SELECT COUNT(*) FROM "Pelatih" WHERE "deletedAt" IS NULL ${pelatihCaborFilter}) AS pelatih,
      (SELECT COUNT(*) FROM "CabangOlahraga") AS cabor,
      (SELECT COUNT(*) FROM "Prestasi"
        WHERE tahun = ${tahun} ${prestasiCaborFilter}
      ) AS prestasi_tahun,
      (SELECT COUNT(*) FROM "Prestasi" WHERE TRUE ${prestasiCaborFilter}) AS prestasi_all,
      ${
        caborId
          ? Prisma.sql`NULL`
          : Prisma.sql`(
              SELECT json_agg(r ORDER BY r.nama) FROM (
                SELECT c.id, c.nama, c."logoOrganisasiUrl" AS logo_organisasi_url,
                  (SELECT COUNT(*) FROM "Atlet"  a WHERE a."cabangOlahragaId" = c.id AND a."deletedAt" IS NULL) AS atlet_count,
                  (SELECT COUNT(*) FROM "Pelatih" p WHERE p."cabangOlahragaId" = c.id AND p."deletedAt" IS NULL) AS pelatih_count,
                  (SELECT COUNT(*) FROM "Prestasi" pr JOIN "Atlet" pa ON pa.id = pr."atletId"
                    WHERE pa."cabangOlahragaId" = c.id AND pa."deletedAt" IS NULL AND pr.medali = 'GOLD')   AS gold_count,
                  (SELECT COUNT(*) FROM "Prestasi" pr JOIN "Atlet" pa ON pa.id = pr."atletId"
                    WHERE pa."cabangOlahragaId" = c.id AND pa."deletedAt" IS NULL AND pr.medali = 'SILVER') AS silver_count,
                  (SELECT COUNT(*) FROM "Prestasi" pr JOIN "Atlet" pa ON pa.id = pr."atletId"
                    WHERE pa."cabangOlahragaId" = c.id AND pa."deletedAt" IS NULL AND pr.medali = 'BRONZE') AS bronze_count
                FROM "CabangOlahraga" c
              ) r
            )`
      } AS per_cabor,
      (SELECT json_agg(r) FROM (
        SELECT medali, COUNT(*) AS cnt FROM "Prestasi"
        WHERE TRUE ${prestasiCaborFilter}
        GROUP BY medali
      ) r) AS prestasi_stats
  `;

  const summary = {
    activeAtletCount: Number(row.active_atlet),
    pelatihCount: Number(row.pelatih),
    caborCount: caborId ? 1 : Number(row.cabor),
    prestasiCount: Number(row.prestasi_tahun),
    prestasiCountAll: Number(row.prestasi_all),
    tahun,
  };

  const perCabor = row.per_cabor
    ? row.per_cabor.map((c) => ({
        cabangOlahragaId: c.id,
        nama: c.nama,
        logoOrganisasiUrl: c.logo_organisasi_url,
        atletCount: Number(c.atlet_count),
        pelatihCount: Number(c.pelatih_count),
        medals: {
          GOLD: Number(c.gold_count),
          SILVER: Number(c.silver_count),
          BRONZE: Number(c.bronze_count),
        },
      }))
    : null;

  const prestasiStats = row.prestasi_stats
    ? row.prestasi_stats.map((s) => ({ key: s.medali, count: Number(s.cnt) }))
    : [];

  return { summary, perCabor, prestasiStats };
}

// specs/002-dashboard/spec.md §3 — single HTTP request, single DB round-trip.
dashboardRouter.get(
  "/all",
  asyncHandler(async (req, res) => {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const tahun = parsed.data.tahun ?? new Date().getFullYear();
    res.json(await fetchAll(req.scopedCaborId, tahun));
  }),
);

