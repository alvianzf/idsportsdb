import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { isForeignKeyConstraintError, isNotFoundError } from "../../lib/prismaErrors.js";
import { createPengurusSchema, updatePengurusSchema, swapPengurusSchema } from "./pengurus.schema.js";

/** Mounted at /api/v1/cabor — `/:caborId/pengurus` (specs/006-pengurus-cabor/spec.md §3). */
export const caborPengurusRouter = Router();
caborPengurusRouter.use(authenticate);

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

    try {
      const pengurus = await prisma.pengurusCabor.create({
        data: { ...parsed.data, cabangOlahragaId: req.params.caborId },
      });
      res.status(201).json(pengurus);
    } catch (err) {
      if (isForeignKeyConstraintError(err)) {
        res.status(400).json({ error: "Cabang olahraga tidak valid" });
        return;
      }
      throw err;
    }
  }),
);

caborPengurusRouter.post(
  "/:caborId/pengurus/swap",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const parsed = swapPengurusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { aId, bId } = parsed.data;
    if (aId === bId) {
      res.status(400).json({ error: "Tidak dapat menukar pengurus dengan dirinya sendiri." });
      return;
    }

    const all = await prisma.pengurusCabor.findMany({
      where: { cabangOlahragaId: req.params.caborId },
    });
    const a = all.find((p) => p.id === aId);
    const b = all.find((p) => p.id === bId);
    if (!a || !b) {
      res.status(404).json({ error: "Pengurus tidak ditemukan pada cabor ini." });
      return;
    }

    // Direct parent↔child swaps can't blindly exchange reportsToId (that would make
    // a node report to itself). Both nodes settle at the original senior's level.
    const aIsParentOfB = b.reportsToId === aId;
    const bIsParentOfA = a.reportsToId === bId;

    const byId = new Map(all.map((p) => [p.id, p]));
    function isDeepAncestor(ancestorId: string, nodeId: string): boolean {
      const node = byId.get(nodeId);
      if (!node?.reportsToId) return false;
      if (node.reportsToId === ancestorId) return true;
      return isDeepAncestor(ancestorId, node.reportsToId);
    }

    const deepCycle =
      !aIsParentOfB &&
      !bIsParentOfA &&
      (isDeepAncestor(aId, bId) || isDeepAncestor(bId, aId));
    if (deepCycle) {
      res.status(400).json({
        error: "Tidak dapat menukar pengurus yang memiliki hubungan hierarki tidak langsung.",
      });
      return;
    }

    let newReportsToA: string | null;
    let newReportsToB: string | null;
    if (aIsParentOfB) {
      newReportsToA = bId;
      newReportsToB = a.reportsToId;
    } else if (bIsParentOfA) {
      newReportsToA = b.reportsToId;
      newReportsToB = aId;
    } else {
      newReportsToA = b.reportsToId;
      newReportsToB = a.reportsToId;
    }

    const reportsOfA = all.filter((p) => p.reportsToId === aId && p.id !== bId);
    const reportsOfB = all.filter((p) => p.reportsToId === bId && p.id !== aId);

    await prisma.$transaction([
      prisma.pengurusCabor.update({
        where: { id: aId },
        data: { jabatan: b.jabatan, reportsToId: newReportsToA },
      }),
      prisma.pengurusCabor.update({
        where: { id: bId },
        data: { jabatan: a.jabatan, reportsToId: newReportsToB },
      }),
      ...reportsOfA.map((p) =>
        prisma.pengurusCabor.update({ where: { id: p.id }, data: { reportsToId: bId } }),
      ),
      ...reportsOfB.map((p) =>
        prisma.pengurusCabor.update({ where: { id: p.id }, data: { reportsToId: aId } }),
      ),
    ]);

    const pengurus = await prisma.pengurusCabor.findMany({
      where: { cabangOlahragaId: req.params.caborId },
      orderBy: { masaBaktiAkhir: "desc" },
    });
    res.json(pengurus);
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
