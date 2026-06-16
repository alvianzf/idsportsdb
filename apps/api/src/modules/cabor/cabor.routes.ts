import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { isNotFoundError, isUniqueConstraintError } from "../../lib/prismaErrors.js";
import { createCaborSchema, updateCaborSchema, listCaborQuerySchema } from "./cabor.schema.js";

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
      include: { _count: { select: { atlets: true, pelatihs: true } } },
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

    await prisma.cabangOlahraga.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
