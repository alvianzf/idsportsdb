import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { isNotFoundError, isUniqueConstraintError } from "../../lib/prismaErrors.js";
import { uploader, publicUrl, uploadRoot, documentFileFilter } from "../../lib/storage.js";
import {
  createAtletSchema,
  updateAtletSchema,
  updateAtletMeSchema,
  listAtletQuerySchema,
  uploadDocumentSchema,
} from "./atlet.schema.js";
import { atletInCaborFilter, caborTambahanInclude, canAccessAtlet } from "./atlet.service.js";
import { emit } from "../../lib/socket.js";

export const atletRouter = Router();

atletRouter.use(authenticate, scopeToCabor);

const documentUpload = uploader("atlet-documents", undefined, documentFileFilter);

const caborSummary = { select: { id: true, nama: true } } as const;

type CaborLainInput = { cabangOlahragaId: string; nomorIndukAtlet?: string; nomorRegistrasi?: string };

function dedupeCaborLain(items: CaborLainInput[] | undefined, primaryId: string): CaborLainInput[] {
  const seen = new Set<string>();
  return (items ?? []).filter((item) => {
    if (item.cabangOlahragaId === primaryId || seen.has(item.cabangOlahragaId)) return false;
    seen.add(item.cabangOlahragaId);
    return true;
  });
}

// specs/004-atlet/spec.md §3
atletRouter.get(
  "/",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  asyncHandler(async (req, res) => {
    const parsed = listAtletQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { cabor, status, kecamatan, search, page, pageSize } = parsed.data;

    const conditions: Prisma.AtletWhereInput[] = [];
    const effectiveCaborId = req.scopedCaborId ?? cabor;
    if (effectiveCaborId) conditions.push(atletInCaborFilter(effectiveCaborId));
    if (status) conditions.push({ statusAtlet: status });
    if (kecamatan) conditions.push({ kecamatan });
    if (search) {
      conditions.push({
        OR: [
          { namaLengkap: { contains: search, mode: "insensitive" } },
          { nik: { contains: search } },
          { nomorRegistrasi: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.AtletWhereInput = conditions.length ? { AND: conditions } : {};

    const [items, total] = await Promise.all([
      prisma.atlet.findMany({
        where,
        include: { cabangOlahraga: caborSummary, ...caborTambahanInclude },
        orderBy: { namaLengkap: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.atlet.count({ where }),
    ]);

    res.json({ items, total });
  }),
);

// specs/004-atlet/spec.md §3 — must be registered before "/:id"
atletRouter.get(
  "/me",
  requireRole(["ATLET"]),
  asyncHandler(async (req, res) => {
    if (!req.user!.athleteId) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const atlet = await prisma.atlet.findUnique({
      where: { id: req.user!.athleteId },
      include: {
        cabangOlahraga: caborSummary,
        ...caborTambahanInclude,
        documents: true,
        prestasis: { orderBy: { tahun: "desc" } },
      },
    });
    if (!atlet) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(atlet);
  }),
);

// Revisi 2026-07-12: athletes self-input their own biodata.
atletRouter.patch(
  "/me",
  requireRole(["ATLET"]),
  asyncHandler(async (req, res) => {
    if (!req.user!.athleteId) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const parsed = updateAtletMeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const atlet = await prisma.atlet.update({
      where: { id: req.user!.athleteId },
      data: parsed.data,
      include: {
        cabangOlahraga: caborSummary,
        ...caborTambahanInclude,
        documents: true,
        prestasis: { orderBy: { tahun: "desc" } },
      },
    });
    emit("atlet:change");
    res.json(atlet);
  }),
);

atletRouter.get(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ATLET"]),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.id },
      include: { cabangOlahraga: caborSummary, ...caborTambahanInclude, documents: true },
    });
    if (!atlet) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canAccessAtlet(req, atlet)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(atlet);
  }),
);

atletRouter.post(
  "/",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const parsed = createAtletSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { cabangOlahragaLain, ...rest } = parsed.data;
    const cabangOlahragaId = req.scopedCaborId ?? rest.cabangOlahragaId;
    const lainItems = dedupeCaborLain(cabangOlahragaLain, cabangOlahragaId);

    try {
      const atlet = await prisma.atlet.create({
        data: {
          ...rest,
          cabangOlahragaId,
          caborTambahan: lainItems.length
            ? { create: lainItems.map(({ cabangOlahragaId: cid, nomorIndukAtlet, nomorRegistrasi }) => ({ cabangOlahragaId: cid, nomorIndukAtlet, nomorRegistrasi })) }
            : undefined,
        },
        include: { cabangOlahraga: caborSummary, ...caborTambahanInclude },
      });
      emit("atlet:change");
      res.status(201).json(atlet);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nomor induk, nomor registrasi, atau NIK sudah digunakan" });
        return;
      }
      throw err;
    }
  }),
);

atletRouter.patch(
  "/:id",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const existing = await prisma.atlet.findUnique({
      where: { id: req.params.id },
      include: caborTambahanInclude,
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canAccessAtlet(req, existing)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = updateAtletSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { cabangOlahragaLain, cabangOlahragaId, ...rest } = parsed.data;

    // specs/004-atlet/spec.md §3 — ADMIN_CABOR cannot change the primary cabor.
    const data: Prisma.AtletUncheckedUpdateInput = { ...rest };
    if (cabangOlahragaId && req.user!.role !== "ADMIN_CABOR") {
      data.cabangOlahragaId = cabangOlahragaId;
    }
    if (cabangOlahragaLain !== undefined) {
      const primaryId = (data.cabangOlahragaId as string | undefined) ?? existing.cabangOlahragaId;
      const lainItems = dedupeCaborLain(cabangOlahragaLain, primaryId);
      data.caborTambahan = {
        deleteMany: {},
        create: lainItems.map(({ cabangOlahragaId: cid, nomorIndukAtlet, nomorRegistrasi }) => ({ cabangOlahragaId: cid, nomorIndukAtlet, nomorRegistrasi })),
      };
    }

    try {
      const atlet = await prisma.atlet.update({
        where: { id: req.params.id },
        data,
        include: { cabangOlahraga: caborSummary, ...caborTambahanInclude, documents: true },
      });
      emit("atlet:change");
      res.json(atlet);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nomor induk, nomor registrasi, atau NIK sudah digunakan" });
        return;
      }
      throw err;
    }
  }),
);

atletRouter.delete(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Deactivate any linked ATLET login so no active account keeps a JWT
        // pointing at a deleted athlete (schema SetNull would orphan it).
        await tx.user.updateMany({
          where: { athleteId: req.params.id },
          data: { isActive: false, athleteId: null },
        });
        await tx.atlet.delete({ where: { id: req.params.id } });
      });
      emit("atlet:change");
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

// specs/004-atlet/spec.md §3
atletRouter.get(
  "/:id/documents",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ATLET"]),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.id },
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

    const documents = await prisma.atletDocument.findMany({
      where: { atletId: req.params.id },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(documents);
  }),
);

atletRouter.post(
  "/:id/documents",
  requireRole(DATA_ADMIN_ROLES),
  documentUpload.single("file"),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.id },
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

    const parsed = uploadDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "File is required" });
      return;
    }

    const fileUrl = publicUrl("atlet-documents", req.file.filename);

    const document = await prisma.atletDocument.create({
      data: { atletId: req.params.id, type: parsed.data.type, fileUrl },
    });

    // specs/004-atlet/spec.md §7 — keep fotoUrl in sync with the PAS_FOTO document.
    if (parsed.data.type === "PAS_FOTO") {
      await prisma.atlet.update({ where: { id: req.params.id }, data: { fotoUrl: fileUrl } });
    }

    res.status(201).json(document);
  }),
);

atletRouter.delete(
  "/:id/documents/:docId",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.id },
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

    const document = await prisma.atletDocument.findUnique({ where: { id: req.params.docId } });
    if (!document || document.atletId !== req.params.id) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await prisma.atletDocument.delete({ where: { id: req.params.docId } });

    // If deleting the PAS_FOTO, also clear fotoUrl on the atlet record
    if (document.type === "PAS_FOTO") {
      await prisma.atlet.update({ where: { id: req.params.id }, data: { fotoUrl: null } });
    }

    const filePath = path.join(uploadRoot, document.fileUrl.replace("/uploads/", ""));
    fs.unlink(filePath, () => undefined);

    res.status(204).send();
  }),
);
