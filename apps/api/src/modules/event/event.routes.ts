import { Router } from "express";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { isForeignKeyConstraintError, isNotFoundError } from "../../lib/prismaErrors.js";
import { createEventSchema, updateEventSchema, listEventQuerySchema } from "./event.schema.js";
import { emit } from "../../lib/socket.js";

// specs/017-event-calendar/spec.md
export const eventRouter = Router();

eventRouter.use(authenticate);

const caborSummary = { select: { id: true, nama: true } } as const;

eventRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listEventQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { status, cabor, page, pageSize } = parsed.data;

    const events = await prisma.event.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(cabor ? { cabangOlahragaId: cabor } : {}),
      },
      include: { cabangOlahraga: caborSummary },
      orderBy: { tanggalMulai: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    res.json(events);
  }),
);

eventRouter.post(
  "/",
  requireRole(UNSCOPED_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const event = await prisma.event.create({
        data: parsed.data,
        include: { cabangOlahraga: caborSummary },
      });
      emit("event:change");
      res.status(201).json(event);
    } catch (err) {
      if (isForeignKeyConstraintError(err)) {
        res.status(400).json({ error: "Cabang olahraga tidak valid" });
        return;
      }
      throw err;
    }
  }),
);

eventRouter.patch(
  "/:id",
  requireRole(UNSCOPED_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const parsed = updateEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const event = await prisma.event.update({
        where: { id: req.params.id },
        data: parsed.data,
        include: { cabangOlahraga: caborSummary },
      });
      emit("event:change");
      res.json(event);
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

eventRouter.delete(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    try {
      await prisma.event.delete({ where: { id: req.params.id } });
      emit("event:change");
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
