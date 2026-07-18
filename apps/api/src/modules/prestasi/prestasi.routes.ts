import fs from "node:fs";
import path from "node:path";
import { Router, type Request } from "express";
import type { Prisma } from "@prisma/client";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { isNotFoundError } from "../../lib/prismaErrors.js";
import { uploader, publicUrl, uploadRoot, documentFileFilter } from "../../lib/storage.js";
import { atletInCaborFilter, atletNotDeleted, caborTambahanInclude, canAccessAtlet } from "../atlet/atlet.service.js";
import { emit } from "../../lib/socket.js";
import { createPrestasiSchema, updatePrestasiSchema, listPrestasiQuerySchema } from "./prestasi.schema.js";
import { writeAudit } from "../../lib/audit.js";

const atletSummary = {
  select: { id: true, namaLengkap: true, cabangOlahragaId: true, cabangOlahraga: { select: { id: true, nama: true } } },
} as const;

const certUpload = uploader("prestasi-sertifikat", undefined, documentFileFilter);

/** Mounted at /api/v1/atlet — `/:atletId/prestasi` (specs/007-prestasi-atlet/spec.md §3). */
export const atletPrestasiRouter = Router();
atletPrestasiRouter.use(authenticate, scopeToCabor);

atletPrestasiRouter.get(
  "/:atletId/prestasi",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA", "ATLET"]),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findFirst({
      where: { id: req.params.atletId, ...atletNotDeleted },
      include: caborTambahanInclude,
    });
    if (!atlet) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canAccessAtlet(req, atlet)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const prestasis = await prisma.prestasi.findMany({
      where: { atletId: req.params.atletId },
      include: { sertifikats: { orderBy: { uploadedAt: "desc" } } },
      orderBy: { tahun: "desc" },
    });
    res.json(prestasis);
  }),
);

atletPrestasiRouter.post(
  "/:atletId/prestasi",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findFirst({
      where: { id: req.params.atletId, ...atletNotDeleted },
      include: caborTambahanInclude,
    });
    if (!atlet) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canAccessAtlet(req, atlet)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = createPrestasiSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const prestasi = await prisma.prestasi.create({
      data: { ...parsed.data, atletId: req.params.atletId },
    });
    emit("prestasi:change");
    writeAudit(req.user!.id, "CREATE", "Prestasi", prestasi.id);
    res.status(201).json(prestasi);
  }),
);

/** Mounted at /api/v1/prestasi (specs/007-prestasi-atlet/spec.md §3). */
export const prestasiRouter = Router();
prestasiRouter.use(authenticate, scopeToCabor);

prestasiRouter.get(
  "/",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA"]),
  asyncHandler(async (req, res) => {
    const parsed = listPrestasiQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { cabor, tahun, medali, tingkat, page, pageSize } = parsed.data;

    const conditions: Prisma.PrestasiWhereInput[] = [];
    const effectiveCaborId = req.scopedCaborId ?? cabor;
    if (effectiveCaborId) conditions.push({ atlet: atletInCaborFilter(effectiveCaborId) });
    if (tahun) conditions.push({ tahun });
    if (medali) conditions.push({ medali });
    if (tingkat) conditions.push({ tingkatKejuaraan: tingkat });

    const where: Prisma.PrestasiWhereInput = conditions.length ? { AND: conditions } : {};

    const [items, total] = await Promise.all([
      prisma.prestasi.findMany({
        where,
        include: { atlet: atletSummary, sertifikats: { orderBy: { uploadedAt: "desc" } } },
        orderBy: [{ tahun: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.prestasi.count({ where }),
    ]);

    res.json({ items, total });
  }),
);

async function loadPrestasiWithAccessCheck(req: Request) {
  const prestasi = await prisma.prestasi.findUnique({
    where: { id: req.params.id },
    include: { atlet: { include: caborTambahanInclude } },
  });
  if (!prestasi) return { prestasi: null, allowed: false };
  return { prestasi, allowed: canAccessAtlet(req, prestasi.atlet) };
}

prestasiRouter.patch(
  "/:id",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { prestasi, allowed } = await loadPrestasiWithAccessCheck(req);
    if (!prestasi) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = updatePrestasiSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const updated = await prisma.prestasi.update({ where: { id: req.params.id }, data: parsed.data });
      emit("prestasi:change");
      writeAudit(req.user!.id, "UPDATE", "Prestasi", updated.id);
      res.json(updated);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

prestasiRouter.delete(
  "/:id",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { prestasi, allowed } = await loadPrestasiWithAccessCheck(req);
    if (!prestasi) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await prisma.prestasi.delete({ where: { id: req.params.id } });
    emit("prestasi:change");
    writeAudit(req.user!.id, "DELETE", "Prestasi", req.params.id);
    res.status(204).send();
  }),
);

prestasiRouter.post(
  "/:id/sertifikat",
  requireRole(DATA_ADMIN_ROLES),
  certUpload.single("file"),
  asyncHandler(async (req, res) => {
    // multer has already written the upload to disk; clean it up on any early exit
    // so a failed existence/access check never orphans the file.
    const cleanupUpload = () => {
      if (req.file) fs.unlink(req.file.path, () => undefined);
    };

    const { prestasi, allowed } = await loadPrestasiWithAccessCheck(req);
    if (!prestasi) {
      cleanupUpload();
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!allowed) {
      cleanupUpload();
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "File is required" });
      return;
    }

    // Revisi 2026-07-18: certificates accumulate (multiple per prestasi)
    // instead of replacing a single file.
    await prisma.prestasiSertifikat.create({
      data: {
        prestasiId: req.params.id,
        fileUrl: publicUrl("prestasi-sertifikat", req.file.filename),
      },
    });
    const updated = await prisma.prestasi.findUnique({
      where: { id: req.params.id },
      include: { sertifikats: { orderBy: { uploadedAt: "desc" } } },
    });
    res.json(updated);
  }),
);

// Revisi 2026-07-18: remove one certificate file from a prestasi.
prestasiRouter.delete(
  "/:id/sertifikat/:sertifikatId",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { prestasi, allowed } = await loadPrestasiWithAccessCheck(req);
    if (!prestasi) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const sertifikat = await prisma.prestasiSertifikat.findFirst({
      where: { id: req.params.sertifikatId, prestasiId: req.params.id },
    });
    if (!sertifikat) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.prestasiSertifikat.delete({ where: { id: sertifikat.id } });
    fs.unlink(path.join(uploadRoot, sertifikat.fileUrl.replace("/uploads/", "")), () => undefined);
    res.status(204).send();
  }),
);
