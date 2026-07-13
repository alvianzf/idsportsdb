import { Router, type Request } from "express";
import type { Prisma } from "@prisma/client";
import type { AthleteStatus } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { isNotFoundError } from "../../lib/prismaErrors.js";
import { atletInCaborFilter, atletNotDeleted, caborTambahanInclude, canAccessAtlet } from "../atlet/atlet.service.js";
import { emit } from "../../lib/socket.js";
import {
  createMonitoringEventSchema,
  updateMonitoringEventSchema,
  listMonitoringQuerySchema,
  mutasiActionSchema,
  mutasiQueueQuerySchema,
} from "./monitoring.schema.js";
import { writeAudit } from "../../lib/audit.js";

const atletSummary = {
  select: { id: true, namaLengkap: true, cabangOlahragaId: true, cabangOlahraga: { select: { id: true, nama: true } } },
} as const;

/** Mounted at /api/v1/atlet — `/:atletId/monitoring` (specs/008-monitoring-atlet/spec.md §3). */
export const atletMonitoringRouter = Router();
atletMonitoringRouter.use(authenticate, scopeToCabor);

atletMonitoringRouter.get(
  "/:atletId/monitoring",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ATLET"]),
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

    const parsed = listMonitoringQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const events = await prisma.monitoringEvent.findMany({
      where: { atletId: req.params.atletId, ...(parsed.data.type ? { type: parsed.data.type } : {}) },
      orderBy: { eventDate: "desc" },
    });
    res.json(events);
  }),
);

atletMonitoringRouter.post(
  "/:atletId/monitoring",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
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

    const parsed = createMonitoringEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { type, description, fromValue, toValue, eventDate } = parsed.data;

    // A STATUS_CHANGE to TRANSFERRED must go through the mutasi approval flow
    // (/monitoring/:id/mutasi), which also moves the athlete's cabor. Allowing
    // it here would set the status while sidestepping that approval.
    if (type === "STATUS_CHANGE" && toValue === "TRANSFERRED") {
      res.status(400).json({ error: "Status TRANSFERRED harus melalui proses mutasi" });
      return;
    }

    // specs/008-monitoring-atlet/spec.md §3
    // NOTE: STATUS_CHANGE writes the athlete's statusAtlet one-way — editing or
    // deleting the event later does NOT revert statusAtlet. Reverting is out of
    // scope (issue #74).
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.monitoringEvent.create({
        data: {
          atletId: req.params.atletId,
          type,
          description,
          fromValue,
          toValue,
          eventDate,
          mutationStatus: type === "MUTATION" ? "PENDING" : undefined,
          createdById: req.user!.id,
        },
      });

      if (type === "STATUS_CHANGE" && toValue) {
        await tx.atlet.update({
          where: { id: req.params.atletId },
          data: { statusAtlet: toValue as AthleteStatus },
        });
      }

      return created;
    });

    emit("monitoring:change");
    res.status(201).json(event);
  }),
);

/** Mounted at /api/v1/monitoring (specs/008-monitoring-atlet/spec.md §3). */
export const monitoringRouter = Router();
monitoringRouter.use(authenticate, scopeToCabor);

async function loadMonitoringWithAccessCheck(req: Request) {
  const event = await prisma.monitoringEvent.findUnique({
    where: { id: req.params.id },
    include: { atlet: { include: caborTambahanInclude } },
  });
  if (!event) return { event: null, allowed: false };
  return { event, allowed: canAccessAtlet(req, event.atlet) };
}

monitoringRouter.patch(
  "/:id",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  asyncHandler(async (req, res) => {
    const { event, allowed } = await loadMonitoringWithAccessCheck(req);
    if (!event) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // specs/008-monitoring-atlet/spec.md §5 — ADMIN_CABOR cannot edit mutation events.
    if (req.user!.role === "ADMIN_CABOR" && event.type === "MUTATION") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = updateMonitoringEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const updated = await prisma.monitoringEvent.update({
        where: { id: req.params.id },
        data: parsed.data,
      });
      emit("monitoring:change");
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

monitoringRouter.get(
  "/",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  asyncHandler(async (req, res) => {
    const parsed = listMonitoringQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const caborId = req.scopedCaborId;
    const where: Prisma.MonitoringEventWhereInput = {
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      // Match canAccessAtlet: include events of multi-cabor athletes whose
      // primary OR additional cabor is the scoped one. Exclude soft-deleted athletes.
      atlet: caborId ? { ...atletInCaborFilter(caborId), deletedAt: null } : { deletedAt: null },
    };

    const events = await prisma.monitoringEvent.findMany({
      where,
      include: { atlet: atletSummary },
      orderBy: { eventDate: "desc" },
    });
    res.json(events);
  }),
);

monitoringRouter.get(
  "/mutasi",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const parsed = mutasiQueueQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const where: Prisma.MonitoringEventWhereInput = {
      type: "MUTATION",
      mutationStatus: parsed.data.status ?? "PENDING",
      atlet: { deletedAt: null },
    };

    const events = await prisma.monitoringEvent.findMany({
      where,
      include: { atlet: atletSummary },
      orderBy: { eventDate: "desc" },
    });
    res.json(events);
  }),
);

// Lightweight count for surfacing pending mutasi to approvers (nav/dashboard
// badge). Kept separate from the queue list so it can be polled cheaply.
monitoringRouter.get(
  "/mutasi/pending-count",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (_req, res) => {
    const count = await prisma.monitoringEvent.count({
      where: { type: "MUTATION", mutationStatus: "PENDING", atlet: { deletedAt: null } },
    });
    res.json({ count });
  }),
);

monitoringRouter.patch(
  "/:id/mutasi",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]),
  asyncHandler(async (req, res) => {
    const event = await prisma.monitoringEvent.findUnique({ where: { id: req.params.id } });
    if (!event || event.type !== "MUTATION") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const parsed = mutasiActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    // Only a PENDING mutation may be acted on — prevents re-approval and the
    // APPROVED->REJECTED drift where the event and the athlete's actual cabor
    // fall permanently out of sync.
    if (event.mutationStatus !== "PENDING") {
      res.status(409).json({ error: "Mutasi ini sudah diproses" });
      return;
    }

    // toValue is a free string at creation; validate the target cabor exists
    // before applying, otherwise the P2003 FK error 500s and blocks approval.
    if (parsed.data.status === "APPROVED") {
      if (!event.toValue) {
        res.status(400).json({ error: "Cabang olahraga tujuan mutasi tidak valid" });
        return;
      }
      const cabor = await prisma.cabangOlahraga.findUnique({
        where: { id: event.toValue },
        select: { id: true },
      });
      if (!cabor) {
        res.status(404).json({ error: "Cabang olahraga tujuan tidak ditemukan" });
        return;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Atomic status transition: the guard above reads the row outside the tx,
      // so two concurrent approve/reject requests can both pass it. This
      // conditional update only flips a still-PENDING row; if a concurrent
      // request already decided this mutation, count === 0 and we roll back —
      // closing the TOCTOU race that left event status and cabor out of sync.
      const { count } = await tx.monitoringEvent.updateMany({
        where: { id: req.params.id, type: "MUTATION", mutationStatus: "PENDING" },
        data: { mutationStatus: parsed.data.status },
      });
      if (count === 0) return null;

      if (parsed.data.status === "APPROVED" && event.toValue) {
        const atlet = await tx.atlet.findUnique({ where: { id: event.atletId } });
        await tx.atlet.update({
          where: { id: event.atletId },
          data: {
            cabangOlahragaId: event.toValue,
            statusAtlet: atlet?.statusAtlet === "TRANSFERRED" ? "ACTIVE" : atlet?.statusAtlet,
          },
        });
      }

      return tx.monitoringEvent.findUnique({ where: { id: req.params.id } });
    });

    if (!updated) {
      res.status(409).json({ error: "Mutasi ini sudah diproses" });
      return;
    }

    emit("monitoring:change");
    writeAudit(req.user!.id, parsed.data.status, "MonitoringMutation", req.params.id);
    res.json(updated);
  }),
);
