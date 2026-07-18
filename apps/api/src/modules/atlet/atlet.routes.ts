import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, requireSelfOrAdmin, scopeToCabor } from "../../middleware/auth.js";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../../lib/prismaErrors.js";
import { uploader, publicUrl, uploadRoot, documentFileFilter } from "../../lib/storage.js";
import {
  createAtletSchema,
  updateAtletSchema,
  updateAtletMeSchema,
  listAtletQuerySchema,
  uploadDocumentSchema,
} from "./atlet.schema.js";
import { atletInCaborFilter, atletNotDeleted, caborTambahanInclude, canAccessAtlet } from "./atlet.service.js";
import { emit } from "../../lib/socket.js";
import { writeAudit } from "../../lib/audit.js";

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
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA"]),
  asyncHandler(async (req, res) => {
    const parsed = listAtletQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { cabor, status, kecamatan, search, deleted, page, pageSize } = parsed.data;

    const conditions: Prisma.AtletWhereInput[] = [];
    // #70 — default lists show only live athletes; ?deleted=true shows the archive.
    conditions.push(deleted ? { deletedAt: { not: null } } : atletNotDeleted);
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

    const atlet = await prisma.atlet.findFirst({
      where: { id: req.user!.athleteId, ...atletNotDeleted },
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

    try {
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
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

atletRouter.get(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA", "ATLET"]),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findFirst({
      where: { id: req.params.id, ...atletNotDeleted },
      include: {
        cabangOlahraga: caborSummary,
        ...caborTambahanInclude,
        documents: true,
        // #68 — surface whether this athlete already has a login so the detail
        // page can offer (or hide) the "Buatkan Akun" shortcut.
        user: { select: { id: true } },
      },
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
    // Cedera detail only applies to status INJURED.
    if (rest.statusAtlet !== "INJURED") {
      rest.tanggalCedera = undefined;
      rest.keteranganCedera = undefined;
    }
    const cabangOlahragaId = req.scopedCaborId ?? rest.cabangOlahragaId;
    const lainItems = dedupeCaborLain(cabangOlahragaLain, cabangOlahragaId);

    // #56 — an ADMIN_CABOR may only manage memberships in their own cabor, which
    // is already forced to be the primary here, so any secondary membership
    // targets a cabor they don't control. Reject rather than silently insert.
    if (req.scopedCaborId && lainItems.some((item) => item.cabangOlahragaId !== req.scopedCaborId)) {
      res.status(403).json({ error: "Tidak dapat menambah keanggotaan cabang olahraga lain" });
      return;
    }

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
      writeAudit(req.user!.id, "CREATE", "Atlet", atlet.id);
      res.status(201).json(atlet);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nomor induk, nomor registrasi, atau NIK sudah digunakan" });
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

atletRouter.patch(
  "/:id",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const existing = await prisma.atlet.findFirst({
      where: { id: req.params.id, ...atletNotDeleted },
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
    // Cedera detail only applies to status INJURED — clear it on any other status.
    if (rest.statusAtlet && rest.statusAtlet !== "INJURED") {
      data.tanggalCedera = null;
      data.keteranganCedera = null;
    }
    if (cabangOlahragaId && req.user!.role !== "ADMIN_CABOR") {
      data.cabangOlahragaId = cabangOlahragaId;
    }
    if (cabangOlahragaLain !== undefined) {
      const primaryId = (data.cabangOlahragaId as string | undefined) ?? existing.cabangOlahragaId;
      const lainItems = dedupeCaborLain(cabangOlahragaLain, primaryId);
      // #56 — a scoped ADMIN_CABOR may only add/remove the membership in their
      // own cabor. Restrict both the wipe and the recreate to that cabor so
      // memberships in cabors they don't control are left untouched.
      const ownItems = req.scopedCaborId
        ? lainItems.filter((item) => item.cabangOlahragaId === req.scopedCaborId)
        : lainItems;
      data.caborTambahan = {
        deleteMany: req.scopedCaborId ? { cabangOlahragaId: req.scopedCaborId } : {},
        create: ownItems.map(({ cabangOlahragaId: cid, nomorIndukAtlet, nomorRegistrasi }) => ({ cabangOlahragaId: cid, nomorIndukAtlet, nomorRegistrasi })),
      };
    }

    try {
      const atlet = await prisma.atlet.update({
        where: { id: req.params.id },
        data,
        include: { cabangOlahraga: caborSummary, ...caborTambahanInclude, documents: true },
      });
      emit("atlet:change");
      writeAudit(req.user!.id, "UPDATE", "Atlet", atlet.id);
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

// #70 — soft-delete: mark the row archived instead of destroying it, so an
// accidental (bulk) delete can be recovered. Files and cascaded records are kept.
atletRouter.delete(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    try {
      // Archive the athlete and deactivate any linked ATLET login together, so
      // no active account is ever left pointing at an archived athlete.
      const count = await prisma.$transaction(async (tx) => {
        const { count } = await tx.atlet.updateMany({
          where: { id: req.params.id, ...atletNotDeleted },
          data: { deletedAt: new Date() },
        });
        if (count === 0) return 0;
        await tx.user.updateMany({
          where: { athleteId: req.params.id },
          data: { isActive: false, athleteId: null },
        });
        return count;
      });
      if (count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      emit("atlet:change");
      writeAudit(req.user!.id, "DELETE", "Atlet", req.params.id);
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

// #70 — restore a soft-deleted athlete (clear deletedAt).
atletRouter.post(
  "/:id/restore",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const { count } = await prisma.atlet.updateMany({
      where: { id: req.params.id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    emit("atlet:change");
    writeAudit(req.user!.id, "RESTORE", "Atlet", req.params.id);
    res.status(204).send();
  }),
);

// #70 — permanent (hard) delete, SUPER_ADMIN only. Kept available for purging
// the archive. Destroys the row, its cascaded records, and its files.
atletRouter.delete(
  "/:id/permanent",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    // Capture the athlete's files before deletion so we can unlink them once the
    // row (and its cascaded documents) are gone. fotoUrl mirrors a PAS_FOTO
    // document, so dedupe to avoid unlinking the same path twice.
    const existing = await prisma.atlet.findUnique({
      where: { id: req.params.id },
      select: { fotoUrl: true, documents: { select: { fileUrl: true } } },
    });
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
      writeAudit(req.user!.id, "PERMANENT_DELETE", "Atlet", req.params.id);
      const urls = new Set(existing?.documents.map((d) => d.fileUrl) ?? []);
      if (existing?.fotoUrl) urls.add(existing.fotoUrl);
      for (const url of urls) {
        fs.unlink(path.join(uploadRoot, url.replace("/uploads/", "")), () => undefined);
      }
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
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ADMIN_DISPORA", "ATLET"]),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findFirst({
      where: { id: req.params.id, ...atletNotDeleted },
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

// #71 — an ATLET may upload documents (incl. PAS_FOTO) to their own record;
// requireSelfOrAdmin gates by athleteId and canAccessAtlet re-checks self below.
atletRouter.post(
  "/:id/documents",
  requireSelfOrAdmin((req) => req.params.id),
  documentUpload.single("file"),
  asyncHandler(async (req, res) => {
    // multer has already written the upload to disk; clean it up on any early exit.
    const cleanupUpload = () => {
      if (req.file) fs.unlink(req.file.path, () => undefined);
    };

    const atlet = await prisma.atlet.findFirst({
      where: { id: req.params.id, ...atletNotDeleted },
      include: caborTambahanInclude,
    });
    if (!atlet) {
      cleanupUpload();
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canAccessAtlet(req, atlet)) {
      cleanupUpload();
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = uploadDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      cleanupUpload();
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "File is required" });
      return;
    }

    const fileUrl = publicUrl("atlet-documents", req.file.filename);

    // specs/004-atlet/spec.md §7 — keep fotoUrl in sync with the PAS_FOTO document;
    // the document row and the fotoUrl update must land together.
    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.atletDocument.create({
        data: { atletId: req.params.id, type: parsed.data.type, fileUrl },
      });
      if (parsed.data.type === "PAS_FOTO") {
        await tx.atlet.update({ where: { id: req.params.id }, data: { fotoUrl: fileUrl } });
      }
      return doc;
    });

    res.status(201).json(document);
  }),
);

// #71 — an ATLET may remove documents from their own record (self-gated).
atletRouter.delete(
  "/:id/documents/:docId",
  requireSelfOrAdmin((req) => req.params.id),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findFirst({
      where: { id: req.params.id, ...atletNotDeleted },
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
