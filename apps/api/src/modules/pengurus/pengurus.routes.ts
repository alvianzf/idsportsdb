import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { isNotFoundError } from "../../lib/prismaErrors.js";
import { createPengurusSchema, updatePengurusSchema, listPengurusQuerySchema } from "./pengurus.schema.js";

/** Mounted at /api/v1/cabor — `/:caborId/pengurus` (specs/006-pengurus-cabor/spec.md §3). */
export const caborPengurusRouter = Router();
caborPengurusRouter.use(authenticate);

caborPengurusRouter.get(
  "/:caborId/pengurus",
  asyncHandler(async (req, res) => {
    const parsed = listPengurusQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const pengurus = await prisma.pengurusCabor.findMany({
      where: {
        cabangOlahragaId: req.params.caborId,
        ...(parsed.data.active ? { masaBaktiAkhir: { gte: new Date() } } : {}),
      },
      orderBy: { masaBaktiAkhir: "desc" },
    });
    res.json(pengurus);
  }),
);

caborPengurusRouter.post(
  "/:caborId/pengurus",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const parsed = createPengurusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (parsed.data.reportsToId) {
      const parent = await prisma.pengurusCabor.findUnique({ where: { id: parsed.data.reportsToId } });
      if (!parent || parent.cabangOlahragaId !== req.params.caborId) {
        res.status(400).json({ error: "Atasan harus berasal dari cabor yang sama." });
        return;
      }
    }

    const pengurus = await prisma.pengurusCabor.create({
      data: { ...parsed.data, cabangOlahragaId: req.params.caborId },
    });
    res.status(201).json(pengurus);
  }),
);

/** Mounted at /api/v1/pengurus — `/:id` (specs/006-pengurus-cabor/spec.md §3). */
export const pengurusRouter = Router();
pengurusRouter.use(authenticate, requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]));

pengurusRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updatePengurusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (parsed.data.reportsToId) {
      if (parsed.data.reportsToId === req.params.id) {
        res.status(400).json({ error: "Pengurus tidak dapat melapor kepada dirinya sendiri." });
        return;
      }

      const current = await prisma.pengurusCabor.findUnique({ where: { id: req.params.id } });
      if (!current) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      let ancestorId: string | null = parsed.data.reportsToId;
      while (ancestorId) {
        const ancestor = await prisma.pengurusCabor.findUnique({ where: { id: ancestorId } });
        if (!ancestor || ancestor.cabangOlahragaId !== current.cabangOlahragaId) {
          res.status(400).json({ error: "Atasan harus berasal dari cabor yang sama." });
          return;
        }
        if (ancestor.id === req.params.id) {
          res.status(400).json({ error: "Struktur organisasi tidak boleh melingkar." });
          return;
        }
        ancestorId = ancestor.reportsToId;
      }
    }

    try {
      const pengurus = await prisma.pengurusCabor.update({ where: { id: req.params.id }, data: parsed.data });
      res.json(pengurus);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

pengurusRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      await prisma.pengurusCabor.delete({ where: { id: req.params.id } });
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
