import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import {
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
} from "../../lib/prismaErrors.js";
import { uploadRoot } from "../../lib/storage.js";
import { createCaborSchema, updateCaborSchema, listCaborQuerySchema } from "./cabor.schema.js";

const logoUpload = multer({
  dest: path.join(uploadRoot, "cabor-logos"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => { cb(null, /^image\//.test(file.mimetype)); },
});

const docUpload = multer({
  dest: path.join(uploadRoot, "cabor-documents"),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => { cb(null, /^image\//.test(file.mimetype) || file.mimetype === "application/pdf"); },
});

export const caborRouter = Router();

// specs/003-cabang-olahraga/spec.md §3 — read access for all authenticated users.
caborRouter.use(authenticate);

caborRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listCaborQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const cabors = await prisma.cabangOlahraga.findMany({
      where: parsed.data.search
        ? { nama: { contains: parsed.data.search, mode: "insensitive" } }
        : undefined,
      include: { _count: { select: { atlets: true, pelatihs: true } } },
      orderBy: { nama: "asc" },
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize,
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
    const cabor = await prisma.cabangOlahraga.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { atlets: true, pelatihs: true } },
        pengurus: { orderBy: { masaBaktiAkhir: "desc" } },
      },
    });
    if (!cabor) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const { _count, ...rest } = cabor;
    res.json({ ...rest, jumlahAtlet: _count.atlets, jumlahPelatih: _count.pelatihs });
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
        include: { _count: { select: { atlets: true, pelatihs: true } } },
      });
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

caborRouter.delete(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const cabor = await prisma.cabangOlahraga.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { atlets: true, pelatihs: true, users: true, pengurus: true } } },
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
      select: { id: true },
    });
    if (!existing) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(404).json({ error: "Not found" });
      return;
    }

    const filename = `${id}${ext}`;
    const destPath = path.join(uploadRoot, "cabor-logos", filename);

    // Rename from multer temp file to stable name keyed by cabor id
    await fs.rename(req.file.path, destPath);

    const logoOrganisasiUrl = `/uploads/cabor-logos/${filename}`;
    try {
      const cabor = await prisma.cabangOlahraga.update({
        where: { id },
        data: { logoOrganisasiUrl },
      });
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
