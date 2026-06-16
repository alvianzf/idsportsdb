import path from "node:path";
import { Router } from "express";
import type { Role } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { caborTambahanInclude, canAccessAtlet } from "../atlet/atlet.service.js";
import { generateQrPng } from "../../lib/qr.js";
import { streamPdf } from "../../lib/pdf.js";
import { uploadRoot } from "../../lib/storage.js";
import { issueCardSchema, downloadCardQuerySchema } from "./cards.schema.js";
import { issueCard, getCurrentCard } from "./cards.service.js";

const adminCaborRoles: Role[] = ["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"];

/** Mounted at /api/v1/atlet (specs/010-kartu-atlet-digital/spec.md §3). */
export const atletCardRouter = Router();
atletCardRouter.use(authenticate, scopeToCabor);

// "/me/card" must be registered before "/:atletId/card" so "me" isn't captured as :atletId.
atletCardRouter.get(
  "/me/card",
  requireRole(["ATLET"]),
  asyncHandler(async (req, res) => {
    if (!req.user!.athleteId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const card = await getCurrentCard(req.user!.athleteId);
    res.json(card);
  }),
);

atletCardRouter.post(
  "/me/card",
  requireRole(["ATLET"]),
  asyncHandler(async (req, res) => {
    if (!req.user!.athleteId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const card = await issueCard(req.user!.athleteId);
    res.status(201).json(card);
  }),
);

atletCardRouter.get(
  "/:atletId/card",
  requireRole(adminCaborRoles),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.atletId },
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

    const card = await getCurrentCard(req.params.atletId);
    res.json(card);
  }),
);

atletCardRouter.post(
  "/:atletId/card",
  requireRole(adminCaborRoles),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.atletId },
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

    const parsed = issueCardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const card = await issueCard(req.params.atletId, parsed.data.expiresAt);
    res.status(201).json(card);
  }),
);

atletCardRouter.post(
  "/:atletId/card/:cardId/revoke",
  requireRole(adminCaborRoles),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.atletId },
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

    const card = await prisma.atletCard.findUnique({ where: { id: req.params.cardId } });
    if (!card || card.atletId !== req.params.atletId) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const updated = await prisma.atletCard.update({
      where: { id: req.params.cardId },
      data: { isRevoked: true },
    });
    res.json(updated);
  }),
);

atletCardRouter.get(
  "/:atletId/card/:cardId/download",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR", "ATLET"]),
  asyncHandler(async (req, res) => {
    const atlet = await prisma.atlet.findUnique({
      where: { id: req.params.atletId },
      include: { cabangOlahraga: { select: { nama: true } }, ...caborTambahanInclude },
    });
    if (!atlet) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canAccessAtlet(req, atlet)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const card = await prisma.atletCard.findUnique({ where: { id: req.params.cardId } });
    if (!card || card.atletId !== req.params.atletId) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const parsed = downloadCardQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const qrPng = await generateQrPng(card.qrPayloadUrl);

    if (parsed.data.format === "png") {
      res.setHeader("Content-Type", "image/png");
      res.send(qrPng);
      return;
    }

    streamPdf(res, `kartu-atlet-${atlet.nomorIndukAtlet}.pdf`, (doc) => {
      doc.fontSize(18).text("Kartu Atlet Digital", { align: "center" });
      doc.moveDown(2);

      if (atlet.fotoUrl) {
        const fotoPath = path.join(uploadRoot, atlet.fotoUrl.replace("/uploads/", ""));
        try {
          doc.image(fotoPath, { width: 100, height: 120 });
          doc.moveDown();
        } catch {
          // fotoUrl missing on disk — skip image, continue with text-only card.
        }
      }

      doc.fontSize(12);
      doc.text(`Nama: ${atlet.namaLengkap}`);
      doc.text(`Nomor Induk Atlet: ${atlet.nomorIndukAtlet}`);
      doc.text(`Nomor Registrasi: ${atlet.nomorRegistrasi}`);
      doc.text(`Cabang Olahraga: ${atlet.cabangOlahraga.nama}`);
      doc.moveDown();
      doc.image(qrPng, { width: 150 });
      doc.moveDown();
      doc.fontSize(9).text(`Kode Kartu: ${card.cardCode}`);
      doc.text(`Verifikasi: ${card.qrPayloadUrl}`);
    });
  }),
);

/** Mounted at /api/v1/cards — public verification endpoint. */
export const cardsRouter = Router();

cardsRouter.get(
  "/verify/:cardCode",
  asyncHandler(async (req, res) => {
    const card = await prisma.atletCard.findUnique({
      where: { cardCode: req.params.cardCode },
      include: {
        atlet: { include: { cabangOlahraga: { select: { id: true, nama: true } } } },
      },
    });

    if (!card) {
      res.status(404).json({ valid: false, reason: "NOT_FOUND" });
      return;
    }
    if (card.isRevoked) {
      res.json({ valid: false, reason: "REVOKED" });
      return;
    }
    if (card.expiresAt && card.expiresAt < new Date()) {
      res.json({ valid: false, reason: "EXPIRED" });
      return;
    }
    if (card.atlet.statusAtlet !== "ACTIVE") {
      res.json({ valid: false, reason: "INACTIVE" });
      return;
    }

    res.json({
      valid: true,
      athlete: {
        namaLengkap: card.atlet.namaLengkap,
        nomorIndukAtlet: card.atlet.nomorIndukAtlet,
        cabangOlahraga: card.atlet.cabangOlahraga,
        fotoUrl: card.atlet.fotoUrl,
        statusAtlet: card.atlet.statusAtlet,
      },
    });
  }),
);
