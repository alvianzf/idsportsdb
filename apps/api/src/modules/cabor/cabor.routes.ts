import path from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { sortByJabatan } from "../../lib/jabatanOrder.js";
import {
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
} from "../../lib/prismaErrors.js";
import { documentFileFilter, uploadRoot, uploader } from "../../lib/storage.js";
import { createCaborSchema, updateCaborSchema, listCaborQuerySchema, setCaborActiveSchema } from "./cabor.schema.js";
import { writeAudit } from "../../lib/audit.js";

// Revisi 2026-07-27: atlet/pelatih are soft-deleted, so an unfiltered _count
// kept reporting removed records (a cabor with nothing in it showed "1 atlet").
const activeCounts = {
  select: {
    atlets: { where: { deletedAt: null } },
    pelatihs: { where: { deletedAt: null } },
  },
} as const;

const logoUpload = multer({
  dest: path.join(uploadRoot, "cabor-logos"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => { cb(null, /^image\//.test(file.mimetype)); },
});

// `uploader` (not bare multer `dest`) so the file keeps its extension — without
// it express.static serves documents as application/octet-stream, which the
// browser downloads instead of rendering in the public SK viewer.
const docUpload = uploader("cabor-documents", 20 * 1024 * 1024, documentFileFilter);

export const caborRouter = Router();

// specs/003-cabang-olahraga/spec.md §3 — read access for all authenticated users,
// narrowed by specs/023-admin-cabor-scoping/spec.md: an ADMIN_CABOR only reads
// their own cabor. Writes were already KONI-only.
caborRouter.use(authenticate, scopeToCabor);

/**
 * 403 when a scoped ADMIN_CABOR asks for a cabor that is not theirs. Returns
 * true when the request was rejected, so callers can `return` immediately.
 */
function rejectOtherCabor(req: Request, res: Response): boolean {
  if (req.scopedCaborId && req.scopedCaborId !== req.params.id) {
    res.status(403).json({ error: "Forbidden" });
    return true;
  }
  return false;
}

caborRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listCaborQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const cabors = await prisma.cabangOlahraga.findMany({
      where: {
        // An ADMIN_CABOR sees only their own cabor in the management list.
        ...(req.scopedCaborId ? { id: req.scopedCaborId } : {}),
        ...(parsed.data.search
          ? { nama: { contains: parsed.data.search, mode: "insensitive" } }
          : {}),
        ...(parsed.data.active !== undefined ? { isActive: parsed.data.active } : {}),
      },
      include: { _count: activeCounts },
      orderBy: { nama: "asc" },
    });

    res.json(
      cabors.map(({ _count, ...c }) => ({
        ...c,
        jumlahAtlet: _count.atlets,
        jumlahPelatih: _count.pelatihs,
      })),
    );
  }),
);

caborRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (rejectOtherCabor(req, res)) return;
    const cabor = await prisma.cabangOlahraga.findUnique({
      where: { id: req.params.id },
      include: {
        _count: activeCounts,
        pengurus: { orderBy: { masaBaktiAkhir: "desc" } },
      },
    });
    if (!cabor) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const { _count, ...rest } = cabor;
    res.json({
      ...rest,
      pengurus: sortByJabatan(rest.pengurus),
      jumlahAtlet: _count.atlets,
      jumlahPelatih: _count.pelatihs,
    });
  }),
);

caborRouter.post(
  "/",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const parsed = createCaborSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const cabor = await prisma.cabangOlahraga.create({ data: parsed.data });
      writeAudit(req.user!.id, "CREATE", "Cabor", cabor.id);
      res.status(201).json({ ...cabor, jumlahAtlet: 0, jumlahPelatih: 0 });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nama cabang olahraga sudah digunakan" });
        return;
      }
      throw err;
    }
  }),
);

caborRouter.patch(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const parsed = updateCaborSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const cabor = await prisma.cabangOlahraga.update({
        where: { id: req.params.id },
        data: parsed.data,
        include: { _count: activeCounts },
      });
      writeAudit(req.user!.id, "UPDATE", "Cabor", cabor.id);
      const { _count, ...rest } = cabor;
      res.json({ ...rest, jumlahAtlet: _count.atlets, jumlahPelatih: _count.pelatihs });
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Nama cabang olahraga sudah digunakan" });
        return;
      }
      throw err;
    }
  }),
);

// Revisi 2026-07-18: SUPER_ADMIN can deactivate/reactivate a cabor. Deactivating
// also deactivates that cabor's ADMIN_CABOR logins; reactivating the cabor does
// NOT auto-reactivate them (reactivate accounts individually via Pengguna).
caborRouter.patch(
  "/:id/active",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const parsed = setCaborActiveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { isActive } = parsed.data;

    try {
      const cabor = await prisma.$transaction(async (tx) => {
        const updated = await tx.cabangOlahraga.update({
          where: { id: req.params.id },
          data: { isActive },
        });
        if (!isActive) {
          await tx.user.updateMany({
            where: { role: "ADMIN_CABOR", cabangOlahragaId: req.params.id },
            data: { isActive: false },
          });
        }
        return updated;
      });
      writeAudit(req.user!.id, isActive ? "ACTIVATE" : "DEACTIVATE", "Cabor", cabor.id);
      res.json(cabor);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

caborRouter.delete(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const cabor = await prisma.cabangOlahraga.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { atlets: true, pelatihs: true, users: true, pengurus: true } },
        documents: { select: { fileUrl: true } },
      },
    });
    if (!cabor) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (cabor._count.atlets > 0 || cabor._count.pelatihs > 0) {
      res.status(409).json({
        error: "Tidak dapat menghapus cabor yang masih memiliki atlet atau pelatih",
      });
      return;
    }
    // Deleting a cabor would SetNull its admins' scope (unscoping them to all
    // cabor) and Restrict-fail on pengurus — block both explicitly.
    if (cabor._count.users > 0 || cabor._count.pengurus > 0) {
      res.status(409).json({
        error: "Tidak dapat menghapus cabor yang masih memiliki admin atau pengurus",
      });
      return;
    }

    try {
      await prisma.cabangOlahraga.delete({ where: { id: req.params.id } });
      writeAudit(req.user!.id, "DELETE", "Cabor", req.params.id);
      // The DB cascade drops the CaborDocument rows; unlink their files too.
      const fs = await import("node:fs/promises");
      for (const doc of cabor.documents) {
        fs.unlink(path.join(uploadRoot, doc.fileUrl.replace("/uploads/", ""))).catch(() => undefined);
      }
      res.status(204).send();
    } catch (err) {
      if (isForeignKeyConstraintError(err)) {
        res.status(409).json({ error: "Tidak dapat menghapus cabor yang masih terpakai" });
        return;
      }
      throw err;
    }
  }),
);

/** POST /cabor/:id/logo — upload/replace the organisasi logo. */
caborRouter.post(
  "/:id/logo",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  logoUpload.single("file"),
  asyncHandler(async (req, res) => {
    const fs = await import("node:fs/promises");
    if (!req.file) {
      res.status(400).json({ error: "File gambar diperlukan." });
      return;
    }

    // The id becomes part of the on-disk filename, so reject anything that
    // could escape the cabor-logos directory (e.g. "..%2F..%2Fx").
    const id = req.params.id;
    if (/[/\\]/.test(id) || id.includes("..")) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(400).json({ error: "ID cabor tidak valid." });
      return;
    }

    // Whitelist the extension instead of trusting originalname.
    const allowedExt: Record<string, string> = {
      ".png": ".png",
      ".jpg": ".jpg",
      ".jpeg": ".jpeg",
      ".webp": ".webp",
    };
    const ext = allowedExt[path.extname(req.file.originalname).toLowerCase()];
    if (!ext) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(400).json({ error: "Format gambar harus png, jpg, jpeg, atau webp." });
      return;
    }

    // Verify the cabor exists before writing so a bogus id cannot leave an
    // orphaned file (and P2025 below stays a defensive guard against races).
    const existing = await prisma.cabangOlahraga.findUnique({
      where: { id },
      select: { id: true, logoOrganisasiUrl: true },
    });
    if (!existing) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Revisi 2026-07-27: the filename used to be just `${id}${ext}`, so a
    // replacement logo reused the same URL and browsers kept serving the cached
    // old image (visible in the edit form). A version suffix makes every upload
    // a distinct URL; the previous file is unlinked below.
    const filename = `${id}-${Date.now()}${ext}`;
    const destPath = path.join(uploadRoot, "cabor-logos", filename);

    await fs.rename(req.file.path, destPath);

    const logoOrganisasiUrl = `/uploads/cabor-logos/${filename}`;
    try {
      const cabor = await prisma.cabangOlahraga.update({
        where: { id },
        data: { logoOrganisasiUrl },
      });
      // Drop the superseded file once the new URL is committed.
      if (existing.logoOrganisasiUrl && existing.logoOrganisasiUrl !== logoOrganisasiUrl) {
        fs.unlink(
          path.join(uploadRoot, existing.logoOrganisasiUrl.replace("/uploads/", "")),
        ).catch(() => undefined);
      }
      res.json({ logoOrganisasiUrl: cabor.logoOrganisasiUrl });
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

// ---------------------------------------------------------------------------
// CaborDocument — SK and official documents
// ---------------------------------------------------------------------------

/** GET /cabor/:id/documents — list all documents for a cabor. */
caborRouter.get(
  "/:id/documents",
  asyncHandler(async (req, res) => {
    if (rejectOtherCabor(req, res)) return;
    const docs = await prisma.caborDocument.findMany({
      where: { caborId: req.params.id },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(docs);
  }),
);

/** POST /cabor/:id/documents — upload a new document. */
caborRouter.post(
  "/:id/documents",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  docUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "File diperlukan." });
      return;
    }

    const { jenis, nomorDokumen, tanggalDokumen, deskripsi } = req.body as {
      jenis?: string;
      nomorDokumen?: string;
      tanggalDokumen?: string;
      deskripsi?: string;
    };

    if (!jenis) {
      res.status(400).json({ error: "Jenis dokumen diperlukan." });
      return;
    }

    const fileUrl = `/uploads/cabor-documents/${req.file.filename}`;

    try {
      const doc = await prisma.caborDocument.create({
        data: {
          caborId: req.params.id,
          jenis,
          nomorDokumen: nomorDokumen || null,
          tanggalDokumen: tanggalDokumen ? new Date(tanggalDokumen) : null,
          deskripsi: deskripsi || null,
          fileUrl,
        },
      });
      res.status(201).json(doc);
    } catch (err) {
      if (isForeignKeyConstraintError(err)) {
        res.status(400).json({ error: "Cabang olahraga tidak valid" });
        return;
      }
      throw err;
    }
  }),
);

/** DELETE /cabor/:id/documents/:docId */
caborRouter.delete(
  "/:id/documents/:docId",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const doc = await prisma.caborDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.caborId !== req.params.id) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.caborDocument.delete({ where: { id: req.params.docId } });
    const fs = await import("node:fs/promises");
    const filePath = path.join(uploadRoot, doc.fileUrl.replace("/uploads/", ""));
    fs.unlink(filePath).catch(() => undefined);
    res.status(204).send();
  }),
);
