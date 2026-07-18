import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
import { uploader, publicUrl, uploadRoot, pdfOrJpgFileFilter } from "../../lib/storage.js";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import {
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
} from "../../lib/prismaErrors.js";
import { createPelatihSchema, updatePelatihSchema, listPelatihQuerySchema } from "./pelatih.schema.js";
import { writeAudit } from "../../lib/audit.js";

export const pelatihRouter = Router();

const caborSummary = { select: { id: true, nama: true } } as const;

pelatihRouter.use(authenticate, scopeToCabor);

// specs/005-pelatih/spec.md §3
pelatihRouter.get(
  "/",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA"]),
  asyncHandler(async (req, res) => {
    const parsed = listPelatihQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { cabor, search, expiring, deleted, page, pageSize } = parsed.data;

    const conditions: Prisma.PelatihWhereInput[] = [];
    // #70 — default lists show only live coaches; ?deleted=true shows the archive.
    conditions.push(deleted ? { deletedAt: { not: null } } : { deletedAt: null });
    const effectiveCaborId = req.scopedCaborId ?? cabor;
    if (effectiveCaborId) conditions.push({ cabangOlahragaId: effectiveCaborId });
    if (search) {
      conditions.push({
        OR: [
          { namaPelatih: { contains: search, mode: "insensitive" } },
          { nomorLisensi: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (expiring) {
      const in90Days = new Date();
      in90Days.setDate(in90Days.getDate() + 90);
      conditions.push({ masaBerlakuAkhir: { lte: in90Days } });
    }

    const where: Prisma.PelatihWhereInput = conditions.length ? { AND: conditions } : {};

    const [items, total] = await Promise.all([
      prisma.pelatih.findMany({
        where,
        include: { cabangOlahraga: caborSummary },
        orderBy: { namaPelatih: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pelatih.count({ where }),
    ]);

    res.json({ items, total });
  }),
);

pelatihRouter.get(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA"]),
  asyncHandler(async (req, res) => {
    const pelatih = await prisma.pelatih.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { cabangOlahraga: caborSummary },
    });
    if (!pelatih) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (req.scopedCaborId && pelatih.cabangOlahragaId !== req.scopedCaborId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(pelatih);
  }),
);

pelatihRouter.post(
  "/",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const parsed = createPelatihSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const cabangOlahragaId = req.scopedCaborId ?? parsed.data.cabangOlahragaId;

    try {
      const pelatih = await prisma.pelatih.create({
        data: { ...parsed.data, cabangOlahragaId },
        include: { cabangOlahraga: caborSummary },
      });
      writeAudit(req.user!.id, "CREATE", "Pelatih", pelatih.id);
      res.status(201).json(pelatih);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nomor lisensi sudah digunakan" });
        return;
      }
      if (isForeignKeyConstraintError(err)) {
        res.status(400).json({ error: "Cabang olahraga tidak valid" });
        return;
      }
      throw err;
    }
  }),
);

pelatihRouter.patch(
  "/:id",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const existing = await prisma.pelatih.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (req.scopedCaborId && existing.cabangOlahragaId !== req.scopedCaborId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = updatePelatihSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { cabangOlahragaId, ...rest } = parsed.data;
    const data: Prisma.PelatihUncheckedUpdateInput = { ...rest };
    if (cabangOlahragaId && req.user!.role !== "ADMIN_CABOR") {
      data.cabangOlahragaId = cabangOlahragaId;
    }

    try {
      const pelatih = await prisma.pelatih.update({
        where: { id: req.params.id },
        data,
        include: { cabangOlahraga: caborSummary },
      });
      writeAudit(req.user!.id, "UPDATE", "Pelatih", pelatih.id);
      res.json(pelatih);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nomor lisensi sudah digunakan" });
        return;
      }
      throw err;
    }
  }),
);

const lisensiUpload = uploader("pelatih-lisensi", undefined, pdfOrJpgFileFilter);

// Revisi 2026-07-18: upload/replace the license scan (PDF or JPG only).
pelatihRouter.post(
  "/:id/lisensi",
  requireRole(DATA_ADMIN_ROLES),
  lisensiUpload.single("file"),
  asyncHandler(async (req, res) => {
    // multer has already written the upload to disk; clean it up on any early
    // exit so a failed existence/access check never orphans the file.
    const cleanupUpload = () => {
      if (req.file) fs.unlink(req.file.path, () => undefined);
    };

    const pelatih = await prisma.pelatih.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!pelatih) {
      cleanupUpload();
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (req.scopedCaborId && pelatih.cabangOlahragaId !== req.scopedCaborId) {
      cleanupUpload();
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "File lisensi harus PDF atau JPG" });
      return;
    }

    const lisensiFileUrl = publicUrl("pelatih-lisensi", req.file.filename);
    const updated = await prisma.pelatih.update({
      where: { id: req.params.id },
      data: { lisensiFileUrl },
    });
    if (pelatih.lisensiFileUrl) {
      fs.unlink(path.join(uploadRoot, pelatih.lisensiFileUrl.replace("/uploads/", "")), () => undefined);
    }
    writeAudit(req.user!.id, "UPDATE", "Pelatih", req.params.id);
    res.json(updated);
  }),
);

// #70 — soft-delete: archive instead of destroying, so an accidental (bulk)
// delete can be recovered.
pelatihRouter.delete(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const { count } = await prisma.pelatih.updateMany({
      where: { id: req.params.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    writeAudit(req.user!.id, "DELETE", "Pelatih", req.params.id);
    res.status(204).send();
  }),
);

// #70 — restore a soft-deleted coach (clear deletedAt).
pelatihRouter.post(
  "/:id/restore",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const { count } = await prisma.pelatih.updateMany({
      where: { id: req.params.id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    writeAudit(req.user!.id, "RESTORE", "Pelatih", req.params.id);
    res.status(204).send();
  }),
);

// #70 — permanent (hard) delete, SUPER_ADMIN only. Kept for purging the archive.
pelatihRouter.delete(
  "/:id/permanent",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    try {
      const deleted = await prisma.pelatih.delete({ where: { id: req.params.id } });
      // Uploaded files are removed together with their DB record.
      if (deleted.lisensiFileUrl) {
        fs.unlink(path.join(uploadRoot, deleted.lisensiFileUrl.replace("/uploads/", "")), () => undefined);
      }
      writeAudit(req.user!.id, "PERMANENT_DELETE", "Pelatih", req.params.id);
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
