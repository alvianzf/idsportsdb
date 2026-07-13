import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
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
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  asyncHandler(async (req, res) => {
    const parsed = listPelatihQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { cabor, search, expiring, page, pageSize } = parsed.data;

    const conditions: Prisma.PelatihWhereInput[] = [];
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
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  asyncHandler(async (req, res) => {
    const pelatih = await prisma.pelatih.findUnique({
      where: { id: req.params.id },
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
    const existing = await prisma.pelatih.findUnique({ where: { id: req.params.id } });
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

pelatihRouter.delete(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    try {
      await prisma.pelatih.delete({ where: { id: req.params.id } });
      writeAudit(req.user!.id, "DELETE", "Pelatih", req.params.id);
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
