import fs from "node:fs";
import path from "node:path";
import type { Response } from "express";
import PDFDocument from "pdfkit";

// Resolved from the process cwd (apps/api) — works for both `npm run dev`
// and the PM2 process, which runs with --cwd apps/api.
const LOGO_PATH = path.resolve("src/assets/logo-koni-batam.png");
const HAS_LOGO = fs.existsSync(LOGO_PATH);

export interface PdfMeta {
  /** Shown in the footer: who downloaded the report. */
  downloadedBy?: string;
}

/** Download date for report titles, e.g. "12 Juli 2026". */
export function dateLabelWib(): string {
  return new Date().toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timestampWib(): string {
  const stamp = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${stamp} WIB`;
}

/** Draws the KONI header + download footer, then resets the cursor to the content area. */
function decoratePage(doc: PDFKit.PDFDocument, meta: PdfMeta) {
  const { width, height } = doc.page;
  const left = doc.page.margins.left;
  const right = width - doc.page.margins.right;

  // Header
  if (HAS_LOGO) doc.image(LOGO_PATH, left, 22, { fit: [36, 36] });
  const textX = left + (HAS_LOGO ? 46 : 0);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1a1a").text("KONI Kota Batam", textX, 28, { lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor("#666666").text("Sistem Informasi Manajemen Atlet", textX, 44, { lineBreak: false });
  doc.moveTo(left, 68).lineTo(right, 68).lineWidth(0.5).strokeColor("#bbbbbb").stroke();

  // Footer — drawn inside the bottom margin, so lift it temporarily or
  // pdfkit auto-inserts a page and recurses through the pageAdded handler.
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const footerLineY = height - 52;
  doc.moveTo(left, footerLineY).lineTo(right, footerLineY).lineWidth(0.5).strokeColor("#bbbbbb").stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor("#666666");
  doc.text(`Diunduh oleh: ${meta.downloadedBy ?? "-"}`, left, footerLineY + 6, { lineBreak: false });
  doc.text(timestampWib(), left, footerLineY + 6, { width: right - left, align: "right", lineBreak: false });
  doc.page.margins.bottom = bottomMargin;

  // Reset for content
  doc.fillColor("#000000").strokeColor("#000000").lineWidth(1);
  doc.x = left;
  doc.y = doc.page.margins.top;
}

/** Starts a PDF response stream; `build` adds content, then the doc is finalized. */
export function streamPdf(
  res: Response,
  filename: string,
  build: (doc: PDFKit.PDFDocument) => void,
  meta: PdfMeta = {},
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: "A4", margins: { top: 84, bottom: 68, left: 40, right: 40 } });
  doc.on("pageAdded", () => decoratePage(doc, meta));
  doc.pipe(res);
  decoratePage(doc, meta);
  build(doc);
  doc.end();
}

/** Draws a simple title + table (header row + data rows) for report PDFs.
 * Column widths are scaled down proportionally if they exceed the printable
 * width, and row heights account for wrapped cell text. */
export function drawPdfTable(
  doc: PDFKit.PDFDocument,
  title: string,
  columns: { header: string; width: number }[],
  rows: (string | number)[][],
) {
  const startX = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const total = columns.reduce((sum, c) => sum + c.width, 0);
  const scale = total > usable ? usable / total : 1;
  const widths = columns.map((c) => Math.floor(c.width * scale));
  const CELL_GAP = 6;
  const bottomY = () => doc.page.height - doc.page.margins.bottom;

  doc.fontSize(16).text(title, { align: "center" });
  doc.moveDown();

  let y = doc.y;

  function drawHeaderRow() {
    doc.fontSize(9).font("Helvetica-Bold");
    let x = startX;
    for (let i = 0; i < columns.length; i++) {
      doc.text(columns[i].header, x, y, { width: widths[i] - CELL_GAP });
      x += widths[i];
    }
    y += 18;
    doc.moveTo(startX, y - 4).lineTo(startX + widths.reduce((a, b) => a + b, 0), y - 4).stroke();
    doc.font("Helvetica");
  }

  drawHeaderRow();

  doc.fontSize(9);
  for (const row of rows) {
    const cells = columns.map((_, i) => String(row[i] ?? ""));
    const rowHeight =
      Math.max(12, ...cells.map((text, i) => doc.heightOfString(text, { width: widths[i] - CELL_GAP }))) + 4;

    if (y + rowHeight > bottomY()) {
      doc.addPage(); // pageAdded handler re-draws header/footer and resets the cursor
      y = doc.page.margins.top;
      drawHeaderRow();
    }

    let x = startX;
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x, y, { width: widths[i] - CELL_GAP });
      x += widths[i];
    }
    y += rowHeight;
  }
  doc.y = y;
  doc.x = startX;
}
