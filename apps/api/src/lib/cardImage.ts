import path from "node:path";
import fs from "node:fs";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

// KONI Batam brand colour (matches --color-primary-500 in the web app)
const PRIMARY = "#c8102e";
const NEUTRAL_800 = "#27272a";
const NEUTRAL_500 = "#71717a";
const NEUTRAL_200 = "#e4e4e7";
const NEUTRAL_50 = "#fafafa";

// CR80 at 300 dpi → 1012 × 638 px (print-ready)
const W = 1012;
const H = 638;
const RADIUS = 24;

function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateCardJpeg(opts: {
  namaLengkap: string;
  nomorIndukAtlet: string;
  nomorRegistrasi: string;
  cabangOlahraga: string;
  statusAtlet: string;
  fotoPath: string | null;
  qrPngBuffer: Buffer;
}): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as SKRSContext2D;

  // ── Card background ──────────────────────────────────────────────────────
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // ── Header band (top 22% of card) ────────────────────────────────────────
  const headerH = Math.round(H * 0.22);
  roundRect(ctx, 0, 0, W, headerH, RADIUS);
  ctx.fillStyle = PRIMARY;
  ctx.fill();
  // Square off the bottom corners of the header
  ctx.fillRect(0, headerH - RADIUS, W, RADIUS);

  // Header text
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 52px sans-serif`;
  ctx.fillText("KONI BATAM", 44, 90);
  ctx.font = `28px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("Kartu Atlet Digital", 44, 128);

  // ── Photo (left column) ───────────────────────────────────────────────────
  const photoX = 40;
  const photoY = headerH + 28;
  const photoW = 210;
  const photoH = H - headerH - 28 - 40; // leave 40px bottom padding

  if (opts.fotoPath && fs.existsSync(opts.fotoPath)) {
    try {
      const img = await loadImage(opts.fotoPath);
      ctx.save();
      roundRect(ctx, photoX, photoY, photoW, photoH, 12);
      ctx.clip();
      // cover-fit
      const scale = Math.max(photoW / img.width, photoH / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, photoX + (photoW - sw) / 2, photoY + (photoH - sh) / 2, sw, sh);
      ctx.restore();
    } catch {
      drawPhotoPlaceholder(ctx, photoX, photoY, photoW, photoH);
    }
  } else {
    drawPhotoPlaceholder(ctx, photoX, photoY, photoW, photoH);
  }

  // ── Athlete info (centre column) ─────────────────────────────────────────
  const infoX = photoX + photoW + 36;
  const infoMaxW = W - infoX - 200; // leave room for QR
  let infoY = headerH + 52;

  ctx.fillStyle = NEUTRAL_800;
  ctx.font = `bold 44px sans-serif`;
  ctx.fillText(truncate(ctx, opts.namaLengkap, infoMaxW), infoX, infoY);
  infoY += 48;

  ctx.fillStyle = PRIMARY;
  ctx.font = `32px sans-serif`;
  ctx.fillText(opts.cabangOlahraga, infoX, infoY);
  infoY += 52;

  // Field rows
  const fields: [string, string][] = [
    ["No. Induk Atlet", opts.nomorIndukAtlet],
    ["No. Registrasi", opts.nomorRegistrasi],
    ["Status", opts.statusAtlet],
  ];

  for (const [label, value] of fields) {
    ctx.fillStyle = NEUTRAL_500;
    ctx.font = `24px sans-serif`;
    ctx.fillText(label, infoX, infoY);
    infoY += 28;
    ctx.fillStyle = NEUTRAL_800;
    ctx.font = `bold 28px sans-serif`;
    ctx.fillText(value, infoX, infoY);
    infoY += 42;
  }

  // ── QR code (right column) ───────────────────────────────────────────────
  const qrSize = 196;
  const qrX = W - qrSize - 40;
  const qrY = headerH + 28;
  const qrImg = await loadImage(opts.qrPngBuffer);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // ── Footer strip ──────────────────────────────────────────────────────────
  const footerY = H - 52;
  ctx.fillStyle = NEUTRAL_50;
  ctx.fillRect(0, footerY, W, 52);
  // Top border of footer
  ctx.strokeStyle = NEUTRAL_200;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(W, footerY);
  ctx.stroke();

  ctx.fillStyle = NEUTRAL_500;
  ctx.font = `22px sans-serif`;
  ctx.fillText("Scan QR untuk verifikasi keaslian kartu ini  ·  KONI Batam", 44, H - 18);

  // ── Card border ───────────────────────────────────────────────────────────
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.strokeStyle = NEUTRAL_200;
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas.toBuffer("image/jpeg", 92) as unknown as Buffer;
}

function drawPhotoPlaceholder(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = "#f4f4f5";
  ctx.fill();
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `24px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Foto", x + w / 2, y + h / 2);
  ctx.textAlign = "left";
}

function truncate(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 0 && ctx.measureText(text + "…").width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + "…";
}
