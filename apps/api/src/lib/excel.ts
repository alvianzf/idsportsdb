import type { Response } from "express";
import ExcelJS from "exceljs";

export interface ExcelSheetSpec {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, unknown>[];
}

/** Streams a multi-sheet .xlsx as the response. */
export async function streamExcelSheets(res: Response, filename: string, sheets: ExcelSheetSpec[]) {
  const workbook = new ExcelJS.Workbook();
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name);
    sheet.columns = spec.columns;
    sheet.addRows(spec.rows);
    sheet.getRow(1).font = { bold: true };
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}

/** Streams a single-sheet .xlsx as the response. */
export function streamExcel(
  res: Response,
  filename: string,
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, unknown>[],
) {
  return streamExcelSheets(res, filename, [{ name: sheetName, columns, rows }]);
}
