import type { Response } from "express";
import PDFDocument from "pdfkit";

/** Starts a PDF response stream; `build` adds content, then the doc is finalized. */
export function streamPdf(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => void) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);
  build(doc);
  doc.end();
}

/** Draws a simple title + table (header row + data rows) for report PDFs. */
export function drawPdfTable(
  doc: PDFKit.PDFDocument,
  title: string,
  columns: { header: string; width: number }[],
  rows: (string | number)[][],
) {
  doc.fontSize(16).text(title, { align: "center" });
  doc.moveDown();

  const startX = doc.page.margins.left;
  let y = doc.y;

  doc.fontSize(9).font("Helvetica-Bold");
  let x = startX;
  for (const col of columns) {
    doc.text(col.header, x, y, { width: col.width });
    x += col.width;
  }
  y += 18;
  doc.moveTo(startX, y - 4).lineTo(doc.page.width - doc.page.margins.right, y - 4).stroke();

  doc.font("Helvetica");
  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    x = startX;
    for (let i = 0; i < columns.length; i++) {
      doc.text(String(row[i] ?? ""), x, y, { width: columns[i].width });
      x += columns[i].width;
    }
    y += 16;
  }
}
