import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { publicArtikelQuerySchema } from "../artikel/artikel.schema.js";
import { sortByJabatan } from "../../lib/jabatanOrder.js";

export const publicRouter = Router();

const articleSummary = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  publishedAt: true,
} as const;

/** Aggregate stats for the public landing page. No auth required. */
publicRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [caborCount, activeAtletCount, pelatihCount, medalGroups] = await Promise.all([
      prisma.cabangOlahraga.count(),
      prisma.atlet.count({ where: { statusAtlet: "ACTIVE", deletedAt: null } }),
      prisma.pelatih.count({ where: { deletedAt: null } }),
      prisma.prestasi.groupBy({ by: ["medali"], _count: { _all: true }, where: { atlet: { deletedAt: null } } }),
    ]);

    const medals = { GOLD: 0, SILVER: 0, BRONZE: 0 };
    for (const g of medalGroups) {
      if (g.medali === "GOLD" || g.medali === "SILVER" || g.medali === "BRONZE") {
        medals[g.medali] = g._count._all;
      }
    }

    res.json({ caborCount, activeAtletCount, pelatihCount, medals });
  }),
);

/** Published articles for the public landing page. No auth required. */
publicRouter.get(
  "/artikel",
  asyncHandler(async (req, res) => {
    const parsed = publicArtikelQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const articles = await prisma.article.findMany({
      where: { published: true },
      select: articleSummary,
      orderBy: { publishedAt: "desc" },
      take: parsed.data.limit ?? 6,
    });
    res.json(articles);
  }),
);

/** Single published article by slug, for the public article detail page. No auth required. */
publicRouter.get(
  "/artikel/:slug",
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findUnique({
      where: { slug: req.params.slug },
      select: { ...articleSummary, content: true, published: true },
    });
    if (!article || !article.published) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(article);
  }),
);

// ---------------------------------------------------------------------------
// Revisi 2026-07-12 — public landing-page menus (specs 017 & 018)
// ---------------------------------------------------------------------------

/** Events for the public "Kalender Event" menu. No auth required. */
publicRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const events = await prisma.event.findMany({
      include: { cabangOlahraga: { select: { id: true, nama: true } } },
      orderBy: { tanggalMulai: "desc" },
      take: limit,
    });
    res.json(events);
  }),
);

/** Censors a name: keeps the first 2 letters of each word, masks the rest with **. */
function censorName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => (word.length <= 2 ? `${word[0] ?? ""}**` : `${word.slice(0, 2)}**`))
    .join(" ");
}

// Revisi 2026-07-18: championship levels rank above the legacy generic levels.
const COMPETITION_LEVEL_RANK: Record<string, number> = {
  OLIMPIADE: 17,
  ASIAN_GAMES: 16,
  SEA_GAMES: 15,
  PON: 14,
  BK_PON: 13,
  PORWIL: 12,
  PORPROV: 11,
  PORDA: 10,
  POPDA: 9,
  PORKOT: 8,
  KEJURNAS: 7,
  KEJURDA: 6,
  EVENT_KHUSUS: 5,
  INTERNASIONAL: 4,
  NASIONAL: 3,
  PROVINSI: 2,
  KOTA: 1,
};
const MEDAL_RANK: Record<string, number> = { GOLD: 3, SILVER: 2, BRONZE: 1, NONE: 0 };

/**
 * Athlete data for the public "Data" menu. Names are censored server-side so
 * real names never leave the API; includes each athlete's highest prestasi.
 */
publicRouter.get(
  "/atlet",
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Number(req.query.pageSize) || 20, 50);

    // Revisi 2026-07-12: mutasi (TRANSFERRED) dan atlet non-aktif tidak
    // ditampilkan di menu Data publik. Revisi 2026-07-18: pensiun (RETIRED) juga.
    const publicWhere = {
      statusAtlet: {
        notIn: ["INACTIVE", "TRANSFERRED", "RETIRED"] as ("INACTIVE" | "TRANSFERRED" | "RETIRED")[],
      },
      deletedAt: null,
    };

    const [atlets, total] = await Promise.all([
      prisma.atlet.findMany({
        where: publicWhere,
        select: {
          id: true,
          namaLengkap: true,
          jenisKelamin: true,
          statusAtlet: true,
          tingkatAtlet: true,
          kecamatan: true,
          cabangOlahraga: { select: { nama: true } },
          prestasis: {
            select: { namaKejuaraan: true, tingkatKejuaraan: true, tingkatLainnya: true, medali: true, tahun: true },
          },
        },
        orderBy: { namaLengkap: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.atlet.count({ where: publicWhere }),
    ]);

    const items = atlets.map((a) => {
      const best = [...a.prestasis].sort(
        (x, y) =>
          (COMPETITION_LEVEL_RANK[y.tingkatKejuaraan] ?? 0) - (COMPETITION_LEVEL_RANK[x.tingkatKejuaraan] ?? 0) ||
          (MEDAL_RANK[y.medali] ?? 0) - (MEDAL_RANK[x.medali] ?? 0) ||
          y.tahun - x.tahun,
      )[0];
      return {
        id: a.id,
        nama: censorName(a.namaLengkap),
        jenisKelamin: a.jenisKelamin,
        statusAtlet: a.statusAtlet,
        tingkatAtlet: a.tingkatAtlet,
        kecamatan: a.kecamatan,
        cabor: a.cabangOlahraga.nama,
        prestasiTertinggi: best ?? null,
      };
    });

    res.json({ items, total });
  }),
);

/**
 * Coach data for the public "Data → Tenaga Olahraga" submenu. Names are NOT
 * censored (client decision, revisi 2026-07-12).
 */
publicRouter.get(
  "/pelatih",
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Number(req.query.pageSize) || 20, 50);

    const [items, total] = await Promise.all([
      prisma.pelatih.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          namaPelatih: true,
          tingkatanLisensi: true,
          masaBerlakuAkhir: true,
          cabangOlahraga: { select: { nama: true } },
        },
        orderBy: { namaPelatih: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pelatih.count({ where: { deletedAt: null } }),
    ]);

    res.json({
      items: items.map((p) => ({
        id: p.id,
        nama: p.namaPelatih,
        tingkatanLisensi: p.tingkatanLisensi,
        masaBerlakuAkhir: p.masaBerlakuAkhir,
        cabor: p.cabangOlahraga.nama,
      })),
      total,
    });
  }),
);

/** Active cabang olahraga for the public Cabor menu (spec 018 §5). No auth required. */
publicRouter.get(
  "/cabor",
  asyncHandler(async (_req, res) => {
    const items = await prisma.cabangOlahraga.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nama: true,
        organisasiNasional: true,
        logoOrganisasiUrl: true,
        _count: { select: { atlets: true, pengurus: true } },
      },
      orderBy: { nama: "asc" },
    });

    res.json({
      items: items.map((c) => ({
        id: c.id,
        nama: c.nama,
        organisasiNasional: c.organisasiNasional,
        logoOrganisasiUrl: c.logoOrganisasiUrl,
        jumlahAtlet: c._count.atlets,
        jumlahPengurus: c._count.pengurus,
      })),
      total: items.length,
    });
  }),
);

/**
 * Officials of one cabor for the public org chart (spec 018 §5). No auth required.
 * Active terms only, and `kontak` is deliberately withheld from the public payload.
 */
publicRouter.get(
  "/cabor/:id/pengurus",
  asyncHandler(async (req, res) => {
    const cabor = await prisma.cabangOlahraga.findFirst({
      where: { id: req.params.id, isActive: true },
      select: { id: true, nama: true, organisasiNasional: true },
    });
    if (!cabor) {
      res.status(404).json({ error: "Cabang olahraga tidak ditemukan" });
      return;
    }

    const [pengurus, dokumen] = await Promise.all([
      // Past terms are shown too (badged "Selesai" in the UI) — a cabor whose
      // latest SK has lapsed would otherwise render an empty org chart.
      prisma.pengurusCabor.findMany({
        where: { cabangOlahragaId: cabor.id },
        select: {
          id: true,
          namaPengurus: true,
          jabatan: true,
          bidang: true,
          masaBaktiMulai: true,
          masaBaktiAkhir: true,
          reportsToId: true,
        },
        orderBy: { namaPengurus: "asc" },
      }),
      // SK / official decrees, shown alongside the org chart on the public page.

      prisma.caborDocument.findMany({
        where: { caborId: cabor.id },
        select: { id: true, jenis: true, nomorDokumen: true, tanggalDokumen: true, fileUrl: true },
        orderBy: { tanggalDokumen: "desc" },
      }),
    ]);

    // Already name-sorted by the query, so a stable rank sort yields
    // jabatan order first, then alphabetical within the same jabatan.
    res.json({ cabor, pengurus: sortByJabatan(pengurus), dokumen });
  }),
);

/** Active landing-page slider images, ordered. No auth required (spec 019). */
publicRouter.get(
  "/slider",
  asyncHandler(async (_req, res) => {
    const slides = await prisma.sliderImage.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, imageUrl: true, caption: true, linkUrl: true },
    });
    res.json(slides);
  }),
);
