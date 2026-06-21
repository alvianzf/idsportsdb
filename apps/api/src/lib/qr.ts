import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const LOGO_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/logo-koni-batam.png",
);

/**
 * Renders `payload` as a PNG QR code with the KONI Batam logo centred inside.
 * Uses error-correction level H (30%) so the logo doesn't break readability.
 */
export async function generateQrPng(payload: string): Promise<Buffer> {
  const size = 300;

  // Generate base QR with high error correction so logo overlay is safe
  const qrBuffer = await QRCode.toBuffer(payload, {
    type: "png",
    margin: 1,
    width: size,
    errorCorrectionLevel: "H",
  });

  // Overlay the logo in the centre
  try {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");

    const qrImg = await loadImage(qrBuffer);
    ctx.drawImage(qrImg, 0, 0, size, size);

    const logoSize = Math.round(size * 0.22); // ~22% of QR size
    const logoX = (size - logoSize) / 2;
    const logoY = (size - logoSize) / 2;

    // White circle backing so logo is legible on QR modules
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, logoSize / 2 + 4, 0, Math.PI * 2);
    ctx.fill();

    const logo = await loadImage(LOGO_PATH);
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

    return canvas.toBuffer("image/png") as unknown as Buffer;
  } catch {
    // If logo fails to load, return plain QR without overlay
    return qrBuffer as Buffer;
  }
}
