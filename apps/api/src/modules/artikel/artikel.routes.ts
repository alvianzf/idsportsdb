import { randomBytes } from "node:crypto";
import { Router } from "express";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { isNotFoundError, isUniqueConstraintError } from "../../lib/prismaErrors.js";
import { uploader, publicUrl, imageFileFilter } from "../../lib/storage.js";
import { createArtikelSchema, updateArtikelSchema, listArtikelQuerySchema } from "./artikel.schema.js";
import { emit } from "../../lib/socket.js";

export const artikelRouter = Router();
artikelRouter.use(authenticate, requireRole(UNSCOPED_ADMIN_ROLES));

const coverUpload = uploader("artikel", undefined, imageFileFilter);
const imageUpload = uploader("artikel-images", 15 * 1024 * 1024, imageFileFilter); // 15MB for inline editor images

const authorSummary = { select: { id: true, fullName: true } } as const;

/** Slugifies a title and appends `-2`, `-3`, ... until the slug is unique. */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "artikel";

  let slug = base;
  let counter = 2;
  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

/** POST /images — upload an inline image for the WYSIWYG editor; returns { url }. */
artikelRouter.post("/images", (req, res, next) => {
  imageUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "Ukuran file terlalu besar (maks. 15 MB)"
          : "Gagal mengunggah gambar";
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "File tidak ditemukan" });
    return;
  }
  res.status(201).json({ url: publicUrl("artikel-images", req.file.filename) });
}));

/** Mounted at /api/v1/artikel (specs/011-artikel/spec.md §3). Admin management endpoints. */
artikelRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listArtikelQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const articles = await prisma.article.findMany({
      where: {
        ...(parsed.data.published !== undefined ? { published: parsed.data.published } : {}),
        ...(parsed.data.search
          ? { title: { contains: parsed.data.search, mode: "insensitive" } }
          : {}),
      },
      include: { author: authorSummary },
      orderBy: { createdAt: "desc" },
    });
    res.json(articles);
  }),
);

artikelRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
      include: { author: authorSummary },
    });
    if (!article) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(article);
  }),
);

artikelRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createArtikelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const published = parsed.data.published ?? false;

    // generateUniqueSlug reads-then-writes, so two concurrent same-title creates
    // can both pick the same free slug and one hits the unique constraint. Retry
    // with a randomised suffix instead of surfacing a 500.
    let slug = await generateUniqueSlug(parsed.data.title);
    for (let attempt = 0; ; attempt++) {
      try {
        const article = await prisma.article.create({
          data: {
            ...parsed.data,
            slug,
            published,
            publishedAt: published ? new Date() : null,
            authorId: req.user!.id,
          },
          include: { author: authorSummary },
        });
        emit("artikel:change");
        res.status(201).json(article);
        return;
      } catch (err) {
        if (isUniqueConstraintError(err) && attempt < 5) {
          slug = `${await generateUniqueSlug(parsed.data.title)}-${randomBytes(3).toString("hex")}`;
          continue;
        }
        throw err;
      }
    }
  }),
);

artikelRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateArtikelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const publishedAt =
        parsed.data.published && !existing.published
          ? new Date()
          : parsed.data.published === false
            ? null
            : undefined;

      const article = await prisma.article.update({
        where: { id: req.params.id },
        data: { ...parsed.data, ...(publishedAt !== undefined ? { publishedAt } : {}) },
        include: { author: authorSummary },
      });
      if (parsed.data.published !== undefined) emit("artikel:change");
      res.json(article);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

artikelRouter.post(
  "/:id/cover",
  coverUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "File tidak ditemukan" });
      return;
    }

    try {
      const coverImageUrl = publicUrl("artikel", req.file.filename);
      const article = await prisma.article.update({
        where: { id: req.params.id },
        data: { coverImageUrl },
        include: { author: authorSummary },
      });
      res.status(201).json(article);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

artikelRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      await prisma.article.delete({ where: { id: req.params.id } });
      emit("artikel:change");
      res.status(204).send();
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);
