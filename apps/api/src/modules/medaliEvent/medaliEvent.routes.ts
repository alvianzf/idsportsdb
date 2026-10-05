import path from "node:path";
import fs from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { uploadRoot } from "../../lib/storage.js";
import { isUniqueConstraintError } from "../../lib/prismaErrors.js";
import {
  createMedaliEventSchema,
  updateMedaliEventSchema,
  createKontingenSchema,
  updateKontingenSchema,
  addEventCaborSchema,
  tallySchema,
} from "./medaliEvent.schema.js";
import { getCurrentEvent } from "./medaliEvent.service.js";

export const medaliEventRouter = Router();

const ADMIN_ROLES = ["SUPER_ADMIN_KONI", "ADMIN_KONI"] as const;

medaliEventRouter.use(authenticate, requireRole([...ADMIN_ROLES]));

const logoUpload = multer({
  dest: path.join(uploadRoot, "medali-event-logos"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => { cb(null, /^image\//.test(file.mimetype)); },
});

/** specs/025-medali-event-adhoc/spec.md — at most one event; GET returns it
 * (with kontingen+tallies) or null. */
medaliEventRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const event = await getCurrentEvent();
    res.json(event);
  }),
);

medaliEventRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createMedaliEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const existing = await prisma.medaliEvent.findFirst({ select: { id: true } });
    if (existing) {
      res.status(409).json({ error: "Sudah ada event aktif. Hapus event yang ada terlebih dahulu." });
      return;
    }
    // Every event needs a "Batam" kontingen to enter our own tally into,
    // same as any other — auto-created so the admin can't skip it.
    const event = await prisma.medaliEvent.create({
      data: { ...parsed.data, kontingen: { create: { nama: "Batam", isOwn: true } } },
      include: { kontingen: true },
    });
    res.status(201).json(event);
  }),
);

medaliEventRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateMedaliEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await prisma.medaliEvent.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(event);
  }),
);

medaliEventRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.medaliEvent.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

/** POST /medali-event/:id/logo — upload/replace the event logo. */
medaliEventRouter.post(
  "/:id/logo",
  logoUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "File gambar diperlukan." });
      return;
    }
    const id = req.params.id;
    if (/[/\\]/.test(id) || id.includes("..")) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(400).json({ error: "ID event tidak valid." });
      return;
    }
    const allowedExt: Record<string, string> = { ".png": ".png", ".jpg": ".jpg", ".jpeg": ".jpeg", ".webp": ".webp" };
    const ext = allowedExt[path.extname(req.file.originalname).toLowerCase()];
    if (!ext) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(400).json({ error: "Format gambar harus png, jpg, jpeg, atau webp." });
      return;
    }

    const existing = await prisma.medaliEvent.findUnique({ where: { id }, select: { id: true, logoUrl: true } });
    if (!existing) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(404).json({ error: "Not found" });
      return;
    }

    const filename = `${id}-${Date.now()}${ext}`;
    const destPath = path.join(uploadRoot, "medali-event-logos", filename);
    await fs.rename(req.file.path, destPath);

    const logoUrl = `/uploads/medali-event-logos/${filename}`;
    await prisma.medaliEvent.update({ where: { id }, data: { logoUrl } });

    if (existing.logoUrl) {
      const oldFile = path.join(uploadRoot, existing.logoUrl.replace(/^\/uploads\//, ""));
      await fs.unlink(oldFile).catch(() => undefined);
    }

    res.json({ logoUrl });
  }),
);

/** DELETE /medali-event/:id/logo — remove the event logo, no replacement. */
medaliEventRouter.delete(
  "/:id/logo",
  asyncHandler(async (req, res) => {
    const existing = await prisma.medaliEvent.findUnique({ where: { id: req.params.id }, select: { logoUrl: true } });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.logoUrl) {
      await prisma.medaliEvent.update({ where: { id: req.params.id }, data: { logoUrl: null } });
      const oldFile = path.join(uploadRoot, existing.logoUrl.replace(/^\/uploads\//, ""));
      await fs.unlink(oldFile).catch(() => undefined);
    }
    res.status(204).end();
  }),
);

medaliEventRouter.post(
  "/:id/kontingen",
  asyncHandler(async (req, res) => {
    const parsed = createKontingenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const kontingen = await prisma.medaliEventKontingen.create({
        data: { medaliEventId: req.params.id, nama: parsed.data.nama },
      });
      res.status(201).json(kontingen);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nama kontingen sudah digunakan pada event ini." });
        return;
      }
      throw err;
    }
  }),
);

medaliEventRouter.patch(
  "/kontingen/:kontingenId",
  asyncHandler(async (req, res) => {
    const parsed = updateKontingenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const kontingen = await prisma.medaliEventKontingen.update({
      where: { id: req.params.kontingenId },
      data: parsed.data,
    });
    res.json(kontingen);
  }),
);

medaliEventRouter.delete(
  "/kontingen/:kontingenId",
  asyncHandler(async (req, res) => {
    const kontingen = await prisma.medaliEventKontingen.findUnique({
      where: { id: req.params.kontingenId },
      select: { isOwn: true },
    });
    if (kontingen?.isOwn) {
      res.status(400).json({ error: "Kontingen Batam tidak dapat dihapus." });
      return;
    }
    await prisma.medaliEventKontingen.delete({ where: { id: req.params.kontingenId } });
    res.status(204).end();
  }),
);

/** POST /medali-event/:id/cabor — register a cabor as contested in this
 * event, independent of any kontingen's (sparse) tally rows. */
medaliEventRouter.post(
  "/:id/cabor",
  asyncHandler(async (req, res) => {
    const parsed = addEventCaborSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const entry = await prisma.medaliEventCabor.create({
        data: { medaliEventId: req.params.id, cabangOlahragaId: parsed.data.cabangOlahragaId },
        include: { cabangOlahraga: { select: { id: true, nama: true } } },
      });
      res.status(201).json(entry);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Cabor sudah terdaftar pada event ini." });
        return;
      }
      throw err;
    }
  }),
);

/** DELETE /medali-event/:id/cabor/:cabangOlahragaId — unregister a cabor
 * from the event. Leaves any already-recorded tallies for it untouched. */
medaliEventRouter.delete(
  "/:id/cabor/:cabangOlahragaId",
  asyncHandler(async (req, res) => {
    await prisma.medaliEventCabor
      .delete({
        where: { medaliEventId_cabangOlahragaId: { medaliEventId: req.params.id, cabangOlahragaId: req.params.cabangOlahragaId } },
      })
      .catch(() => undefined);
    res.status(204).end();
  }),
);

/** PUT /medali-event/kontingen/:kontingenId/tally/:cabangOlahragaId — upsert
 * one cabor's medal count for a kontingen; all-zero deletes the row. */
medaliEventRouter.put(
  "/kontingen/:kontingenId/tally/:cabangOlahragaId",
  asyncHandler(async (req, res) => {
    const parsed = tallySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { kontingenId, cabangOlahragaId } = req.params;
    const { gold, silver, bronze } = parsed.data;

    if (gold === 0 && silver === 0 && bronze === 0) {
      await prisma.medaliEventKontingenTally
        .delete({ where: { kontingenId_cabangOlahragaId: { kontingenId, cabangOlahragaId } } })
        .catch(() => undefined);
      res.status(204).end();
      return;
    }

    const tally = await prisma.medaliEventKontingenTally.upsert({
      where: { kontingenId_cabangOlahragaId: { kontingenId, cabangOlahragaId } },
      create: { kontingenId, cabangOlahragaId, gold, silver, bronze },
      update: { gold, silver, bronze },
    });
    res.json(tally);
  }),
);
