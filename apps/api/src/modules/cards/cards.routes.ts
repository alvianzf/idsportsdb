import path from "node:path";
import { Router } from "express";
import { createRequire } from "node:module";
// archiver v5 is a CJS default-export function; @types/archiver v8 doesn't match — cast via any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const archiver = createRequire(import.meta.url)("archiver") as any;

import type { Role } from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { atletInCaborFilter, caborTambahanInclude, canAccessAtlet } from "../atlet/atlet.service.js";
import { generateQrPng } from "../../lib/qr.js";
import { generateCardJpeg } from "../../lib/cardImage.js";
import { uploadRoot } from "../../lib/storage.js";
import { issueCardSchema, downloadCardQuerySchema, bulkDownloadBodySchema } from "./cards.schema.js";
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

    // JPEG card image (CR80 at 300 dpi — 1012 × 638 px)
    const fotoPath = atlet.fotoUrl
      ? path.join(uploadRoot, atlet.fotoUrl.replace("/uploads/", ""))
      : null;

    const jpeg = await generateCardJpeg({
      namaLengkap: atlet.namaLengkap,
      nomorIndukAtlet: atlet.nomorIndukAtlet,
      nomorRegistrasi: atlet.nomorRegistrasi,
      cabangOlahraga: atlet.cabangOlahraga.nama,
      statusAtlet: atlet.statusAtlet,
      fotoPath,
      qrPngBuffer: qrPng,
    });

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="kartu-atlet-${atlet.nomorIndukAtlet}.jpg"`,
    );
    res.send(jpeg);
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

// POST /api/v1/cards/bulk-download — generate a ZIP of JPEG cards for selected athletes.
// Requires authentication (admin roles). Athletes the caller cannot access are silently skipped.
cardsRouter.post(
  "/bulk-download",
  authenticate,
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  scopeToCabor,
  asyncHandler(async (req, res) => {
    const parsed = bulkDownloadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { ids } = parsed.data;
    const caborId = req.scopedCaborId;

    // Fetch all requested athletes in one query, scoped to caller's cabor.
    const atlets = await prisma.atlet.findMany({
      where: {
        id: { in: ids },
        ...(caborId ? atletInCaborFilter(caborId) : {}),
      },
      include: { cabangOlahraga: { select: { nama: true } } },
    });

    if (atlets.length === 0) {
      res.status(404).json({ error: "No accessible athletes found for the given IDs." });
      return;
    }

    // Fetch active cards for all athletes in one query.
    const cards = await prisma.atletCard.findMany({
      where: {
        atletId: { in: atlets.map((a) => a.id) },
        isRevoked: false,
      },
      orderBy: { issuedAt: "desc" },
    });

    // Keep only the latest non-revoked card per athlete.
    const cardByAtletId = new Map(cards.map((c) => [c.atletId, c]));

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="kartu-atlet-bulk.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err: Error) => {
      // Headers already sent; can only log.
      console.error("[bulk-download] archiver error:", err);
      res.end();
    });
    archive.pipe(res);

    for (const atlet of atlets) {
      const card = cardByAtletId.get(atlet.id);
      if (!card) continue; // athlete has no active card — skip

      try {
        const qrPng = await generateQrPng(card.qrPayloadUrl);
        const fotoPath = atlet.fotoUrl
          ? path.join(uploadRoot, atlet.fotoUrl.replace("/uploads/", ""))
          : null;

        const jpeg = await generateCardJpeg({
          namaLengkap: atlet.namaLengkap,
          nomorIndukAtlet: atlet.nomorIndukAtlet,
          nomorRegistrasi: atlet.nomorRegistrasi,
          cabangOlahraga: atlet.cabangOlahraga.nama,
          statusAtlet: atlet.statusAtlet,
          fotoPath,
          qrPngBuffer: qrPng,
        });

        const filename = `${atlet.nomorIndukAtlet}-${atlet.namaLengkap.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
        archive.append(jpeg, { name: filename });
      } catch (err) {
        console.error(`[bulk-download] failed to generate card for ${atlet.id}:`, err);
        // Continue with remaining athletes.
      }
    }

    await archive.finalize();
  }),
);
