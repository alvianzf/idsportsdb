import QRCode from "qrcode";

/** Renders `payload` (a URL) as a PNG buffer for embedding in cards/downloads. */
export function generateQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, { type: "png", margin: 1, width: 300 });
}
