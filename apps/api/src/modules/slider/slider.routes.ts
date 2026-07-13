import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { isNotFoundError } from "../../lib/prismaErrors.js";
import { uploader, publicUrl, uploadRoot } from "../../lib/storage.js";
import { emit } from "../../lib/socket.js";

// specs/019-landing-slider/spec.md — landing-page slider, superadmin-managed.
export const sliderRouter = Router();

sliderRouter.use(authenticate, requireRole(["SUPER_ADMIN_KONI"]));

const imageUpload = uploader("slider");

const updateSliderSchema = z.object({
  caption: z.string().nullable().optional(),
  linkUrl: z.string().nullable().optional(),
  order: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

sliderRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const slides = await prisma.sliderImage.findMany({ orderBy: { order: "asc" } });
    res.json(slides);
  }),
);

sliderRouter.post(
  "/",
  imageUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "File gambar wajib diunggah" });
      return;
    }
    if (!req.file.mimetype.startsWith("image/")) {
      fs.unlink(req.file.path, () => undefined);
      res.status(400).json({ error: "File harus berupa gambar (JPG/PNG/WebP)" });
      return;
    }

    const last = await prisma.sliderImage.findFirst({ orderBy: { order: "desc" } });
    const slide = await prisma.sliderImage.create({
      data: {
        imageUrl: publicUrl("slider", req.file.filename),
        caption: typeof req.body.caption === "string" && req.body.caption ? req.body.caption : null,
        order: (last?.order ?? -1) + 1,
      },
    });
    emit("slider:change");
    res.status(201).json(slide);
  }),
);

const reorderSliderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

sliderRouter.patch(
  "/reorder",
  asyncHandler(async (req, res) => {
    const parsed = reorderSliderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      await prisma.$transaction(
        parsed.data.ids.map((id, index) =>
          prisma.sliderImage.update({ where: { id }, data: { order: index } }),
        ),
      );
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }

    emit("slider:change");
    const slides = await prisma.sliderImage.findMany({ orderBy: { order: "asc" } });
    res.json(slides);
  }),
);

sliderRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSliderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const slide = await prisma.sliderImage.update({
        where: { id: req.params.id },
        data: parsed.data,
      });
      emit("slider:change");
      res.json(slide);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

sliderRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const slide = await prisma.sliderImage.findUnique({ where: { id: req.params.id } });
    if (!slide) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await prisma.sliderImage.delete({ where: { id: req.params.id } });
    fs.unlink(path.join(uploadRoot, slide.imageUrl.replace("/uploads/", "")), () => undefined);
    emit("slider:change");
    res.status(204).send();
  }),
);
