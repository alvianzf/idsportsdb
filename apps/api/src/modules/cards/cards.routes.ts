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
      // CR80 card: 85.6mm × 53.98mm = 242.6pt × 153pt, centred on A4
      const cardW = 243;
      const cardH = 153;
      const pageW = doc.page.width;   // 595pt (A4)
      const pageH = doc.page.height;  // 842pt
      const cx = (pageW - cardW) / 2;
      const cy = (pageH - cardH) / 2;

      // ── Card outline ──────────────────────────────────────────────────────
      doc.roundedRect(cx, cy, cardW, cardH, 6).fillAndStroke("#ffffff", "#cccccc");

      // ── Header band ───────────────────────────────────────────────────────
      const headerH = 30;
      doc.save();
      doc.roundedRect(cx, cy, cardW, headerH, 6).clip();
      doc.rect(cx, cy, cardW, headerH).fill("#1a56db");
      doc.restore();

      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text("KONI BATAM", cx + 8, cy + 7, { width: cardW - 16 })
        .fontSize(7).font("Helvetica")
        .text("Kartu Atlet Digital", cx + 8, cy + 18, { width: cardW - 16 });

      // ── Photo ─────────────────────────────────────────────────────────────
      const photoX = cx + 8;
      const photoY = cy + headerH + 8;
      const photoW = 55;
      const photoH = 70;

      if (atlet.fotoUrl) {
        const fotoPath = path.join(uploadRoot, atlet.fotoUrl.replace("/uploads/", ""));
        try {
          doc.save();
          doc.rect(photoX, photoY, photoW, photoH).clip();
          doc.image(fotoPath, photoX, photoY, { width: photoW, height: photoH, cover: [photoW, photoH] });
          doc.restore();
          doc.rect(photoX, photoY, photoW, photoH).stroke("#dddddd");
        } catch {
          // photo missing — draw placeholder
          doc.rect(photoX, photoY, photoW, photoH).fillAndStroke("#f0f0f0", "#dddddd");
          doc.fillColor("#aaaaaa").fontSize(7).text("Foto", photoX, photoY + photoH / 2 - 4, { width: photoW, align: "center" });
        }
      } else {
        doc.rect(photoX, photoY, photoW, photoH).fillAndStroke("#f0f0f0", "#dddddd");
        doc.fillColor("#aaaaaa").fontSize(7).text("Foto", photoX, photoY + photoH / 2 - 4, { width: photoW, align: "center" });
      }

      // ── Athlete info ──────────────────────────────────────────────────────
      const infoX = cx + photoW + 16;
      const infoW = cardW - photoW - 24;
      let infoY = cy + headerH + 8;

      doc.fillColor("#111111").font("Helvetica-Bold").fontSize(8.5)
        .text(atlet.namaLengkap, infoX, infoY, { width: infoW });
      infoY += 13;

      doc.fillColor("#555555").font("Helvetica").fontSize(7)
        .text(atlet.cabangOlahraga.nama, infoX, infoY, { width: infoW });
      infoY += 11;

      doc.fillColor("#777777").fontSize(6.5)
        .text("No. Induk", infoX, infoY, { width: infoW });
      infoY += 9;
      doc.fillColor("#111111").font("Helvetica-Bold").fontSize(7.5)
        .text(atlet.nomorIndukAtlet, infoX, infoY, { width: infoW });
      infoY += 11;

      doc.fillColor("#777777").font("Helvetica").fontSize(6.5)
        .text("No. Registrasi", infoX, infoY, { width: infoW });
      infoY += 9;
      doc.fillColor("#111111").font("Helvetica-Bold").fontSize(7)
        .text(atlet.nomorRegistrasi, infoX, infoY, { width: infoW });

      // ── QR code ───────────────────────────────────────────────────────────
      const qrSize = 48;
      const qrX = cx + cardW - qrSize - 8;
      const qrY = cy + headerH + 8;
      doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });

      // ── Footer strip ──────────────────────────────────────────────────────
      const footerY = cy + cardH - 18;
      doc.save();
      doc.rect(cx, footerY, cardW, 18).clip();
      // bottom corners need rounding — redraw clip with rounded bottom
      doc.restore();
      doc.rect(cx, footerY, cardW, 18).fill("#f8f8f8");
      doc.moveTo(cx, footerY).lineTo(cx + cardW, footerY).stroke("#dddddd");

      doc.fillColor("#888888").font("Helvetica").fontSize(5.5)
        .text(`Kode: ${card.cardCode}`, cx + 8, footerY + 4, { width: cardW - 16 })
        .text("Verifikasi: scan QR code di atas", cx + 8, footerY + 10, { width: cardW - 16 });

      // ── Cut guide text ────────────────────────────────────────────────────
      doc.fillColor("#aaaaaa").fontSize(7)
        .text("Potong mengikuti garis kartu · CR80 85.6 × 54 mm", cx, cy + cardH + 8, { width: cardW, align: "center" });
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
    // Always include atletId so authenticated admins can navigate to the record page
    // even when the athlete is inactive.
    const athletePayload = {
      atletId: card.atlet.id,
      namaLengkap: card.atlet.namaLengkap,
      nomorIndukAtlet: card.atlet.nomorIndukAtlet,
      cabangOlahraga: card.atlet.cabangOlahraga,
      fotoUrl: card.atlet.fotoUrl,
      statusAtlet: card.atlet.statusAtlet,
    };

    if (card.atlet.statusAtlet !== "ACTIVE") {
      res.json({ valid: false, reason: "INACTIVE", athlete: athletePayload });
      return;
    }

    res.json({ valid: true, athlete: athletePayload });
  }),
);
