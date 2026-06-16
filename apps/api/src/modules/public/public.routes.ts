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
