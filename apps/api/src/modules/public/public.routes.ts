import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { publicArtikelQuerySchema } from "../artikel/artikel.schema.js";

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
      prisma.atlet.count({ where: { statusAtlet: "ACTIVE" } }),
      prisma.pelatih.count(),
      prisma.prestasi.groupBy({ by: ["medali"], _count: { _all: true } }),
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

const COMPETITION_LEVEL_RANK: Record<string, number> = {
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
    // ditampilkan di menu Data publik.
    const publicWhere = {
      statusAtlet: { notIn: ["INACTIVE", "TRANSFERRED"] as ("INACTIVE" | "TRANSFERRED")[] },
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
            select: { namaKejuaraan: true, tingkatKejuaraan: true, medali: true, tahun: true },
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
      prisma.pelatih.count(),
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
