import { Readable } from "node:stream";
import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  ATHLETE_STATUS_LABELS,
  DATA_ADMIN_ROLES,
  GENDER_LABELS,
  type AthleteStatus,
  type Gender,
} from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { streamExcel } from "../../lib/excel.js";
import { streamPdf, drawPdfTable } from "../../lib/pdf.js";
import { isUniqueConstraintError } from "../../lib/prismaErrors.js";
import { createAtletSchema, listAtletQuerySchema } from "./atlet.schema.js";
import { atletInCaborFilter } from "./atlet.service.js";
import { emit } from "../../lib/socket.js";

// Revisi 2026-07-12: bulk download (Excel/CSV/PDF) and bulk update via
// uploaded Excel/CSV. Mounted before atletRouter so /export and /import
// are not swallowed by its "/:id" route.
export const atletBulkRouter = Router();

atletBulkRouter.use(authenticate, scopeToCabor);

const exportQuerySchema = listAtletQuerySchema.omit({ page: true, pageSize: true }).extend({
  format: z.enum(["xlsx", "csv", "pdf"]).default("xlsx"),
});

const EXPORT_COLUMNS = [
  { header: "Nomor Induk", key: "nomorIndukAtlet", width: 16 },
  { header: "Nomor Registrasi", key: "nomorRegistrasi", width: 18 },
  { header: "Nama Lengkap", key: "namaLengkap", width: 28 },
  { header: "NIK", key: "nik", width: 20 },
  { header: "Jenis Kelamin", key: "jenisKelamin", width: 14 },
  { header: "Cabang Olahraga", key: "cabor", width: 20 },
  { header: "Status", key: "statusAtlet", width: 12 },
  { header: "Alamat", key: "alamat", width: 32 },
  { header: "Kecamatan", key: "kecamatan", width: 16 },
  { header: "Nomor HP", key: "nomorHp", width: 14 },
  { header: "Email", key: "email", width: 24 },
  { header: "Pendidikan Terakhir", key: "pendidikan", width: 18 },
  { header: "Pekerjaan", key: "pekerjaan", width: 18 },
];

atletBulkRouter.get(
  "/export",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  asyncHandler(async (req, res) => {
    const parsed = exportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { format, cabor, status, kecamatan, search } = parsed.data;

    const conditions: Prisma.AtletWhereInput[] = [];
    const effectiveCaborId = req.scopedCaborId ?? cabor;
    if (effectiveCaborId) conditions.push(atletInCaborFilter(effectiveCaborId));
    if (status) conditions.push({ statusAtlet: status });
    if (kecamatan) conditions.push({ kecamatan });
    if (search) {
      conditions.push({
        OR: [
          { namaLengkap: { contains: search, mode: "insensitive" } },
          { nik: { contains: search } },
          { nomorRegistrasi: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const atlets = await prisma.atlet.findMany({
      where: conditions.length ? { AND: conditions } : {},
      include: { cabangOlahraga: { select: { nama: true } } },
      orderBy: { namaLengkap: "asc" },
    });

    const rows = atlets.map((a) => ({
      nomorIndukAtlet: a.nomorIndukAtlet,
      nomorRegistrasi: a.nomorRegistrasi,
      namaLengkap: a.namaLengkap,
      nik: a.nik,
      jenisKelamin: GENDER_LABELS[a.jenisKelamin as Gender],
      cabor: a.cabangOlahraga.nama,
      statusAtlet: ATHLETE_STATUS_LABELS[a.statusAtlet as AthleteStatus],
      alamat: a.alamat,
      kecamatan: a.kecamatan ?? "",
      nomorHp: a.nomorHp ?? "",
      email: a.email ?? "",
      pendidikan: a.pendidikan ?? "",
      pekerjaan: a.pekerjaan ?? "",
    }));

    if (format === "pdf") {
      streamPdf(res, "data-atlet.pdf", (doc) => {
        drawPdfTable(
          doc,
          "Data Atlet KONI Batam",
          [
            { header: "Nama", width: 130 },
            { header: "No. Registrasi", width: 85 },
            { header: "Cabor", width: 90 },
            { header: "JK", width: 25 },
            { header: "Kecamatan", width: 85 },
            { header: "Status", width: 60 },
          ],
          rows.map((r) => [r.namaLengkap, r.nomorRegistrasi, r.cabor, r.jenisKelamin === "Laki-laki" ? "L" : "P", r.kecamatan, r.statusAtlet]),
        );
      });
      return;
    }

    if (format === "csv") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Atlet");
      sheet.columns = EXPORT_COLUMNS;
      sheet.addRows(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="data-atlet.csv"');
      await workbook.csv.write(res);
      res.end();
      return;
    }

    await streamExcel(res, "data-atlet.xlsx", "Atlet", EXPORT_COLUMNS, rows);
  }),
);

// ---------------------------------------------------------------------------
// Import template — downloadable sample so users upload the right format.
// ---------------------------------------------------------------------------

const TEMPLATE_SAMPLE_ROWS = [
  {
    nomorIndukAtlet: "ATL-2026-001",
    nomorRegistrasi: "REG-ATL-001",
    namaLengkap: "Budi Santoso",
    nik: "2171010101990001",
    jenisKelamin: "L",
    cabor: "Atletik",
    statusAtlet: "Aktif",
    alamat: "Jl. Contoh No. 1, Batam Kota",
    kecamatan: "Batam Kota",
    nomorHp: "081234567890",
    email: "budi@email.com",
    pendidikan: "SMA/SMK",
    pekerjaan: "Pelajar",
  },
  {
    nomorIndukAtlet: "REN-2026-002",
    nomorRegistrasi: "REG-REN-002",
    namaLengkap: "Siti Aminah",
    nik: "2171010101990002",
    jenisKelamin: "P",
    cabor: "Renang",
    statusAtlet: "Tidak Aktif",
    alamat: "Jl. Contoh No. 2, Sekupang",
    kecamatan: "Sekupang",
    nomorHp: "081234567891",
    email: "",
    pendidikan: "S1",
    pekerjaan: "",
  },
];

atletBulkRouter.get(
  "/import/template",
  requireRole(DATA_ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const format = req.query.format === "csv" ? "csv" : "xlsx";

    if (format === "csv") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Template");
      sheet.columns = EXPORT_COLUMNS;
      sheet.addRows(TEMPLATE_SAMPLE_ROWS);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="template-impor-atlet.csv"');
      await workbook.csv.write(res);
      res.end();
      return;
    }

    await streamExcel(res, "template-impor-atlet.xlsx", "Template", EXPORT_COLUMNS, TEMPLATE_SAMPLE_ROWS);
  }),
);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** Maps a normalized header cell to an import field key. */
function headerToKey(header: string): string | null {
  const h = header.toLowerCase();
  if (h.includes("induk")) return "nomorIndukAtlet";
  if (h.includes("registrasi")) return "nomorRegistrasi";
  if (h.includes("nama")) return "namaLengkap";
  if (h.includes("nik")) return "nik";
  if (h.includes("kelamin") || h === "jk") return "jenisKelamin";
  if (h.includes("cabang") || h.includes("cabor")) return "cabor";
  if (h.includes("status")) return "statusAtlet";
  if (h.includes("alamat")) return "alamat";
  if (h.includes("kecamatan")) return "kecamatan";
  if (h.includes("hp") || h.includes("telepon")) return "nomorHp";
  if (h.includes("email")) return "email";
  if (h.includes("pendidikan")) return "pendidikan";
  if (h.includes("pekerjaan")) return "pekerjaan";
  return null;
}

function parseGender(value: string): Gender | null {
  const v = value.trim().toLowerCase();
  if (v === "l" || v.startsWith("laki") || v === "m") return "L";
  if (v === "p" || v.startsWith("perempuan") || v === "f") return "P";
  return null;
}

function parseStatus(value: string): AthleteStatus | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "aktif" || v === "active") return "ACTIVE";
  if (v.includes("tidak") || v.includes("non") || v === "inactive") return "INACTIVE";
  return null;
}

/** Lowercase, trim, and collapse internal whitespace — for lenient name matching. */
function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Levenshtein edit distance between two strings. */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Closest valid cabor name to a typo'd input, or null if nothing is close enough. */
function suggestCabor(input: string, names: string[]): string | null {
  const norm = normalizeName(input);
  if (!norm) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const name of names) {
    const dist = editDistance(norm, normalizeName(name));
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  // Only suggest when reasonably close: <=2 edits, or within ~40% of the length.
  return best && bestDist <= Math.max(2, Math.floor(norm.length * 0.4)) ? best : null;
}

const importRowSchema = createAtletSchema.omit({
  cabangOlahragaId: true,
  cabangOlahragaLain: true,
  tempatLahir: true,
  tanggalLahir: true,
  tingkatAtlet: true,
});

atletBulkRouter.post(
  "/import",
  requireRole(DATA_ADMIN_ROLES),
  importUpload.single("file"),
  asyncHandler(async (req, res) => {
    // ?dryRun=1 parses and validates without writing — powers the client-side
    // preview shown before the actual upload.
    const dryRun = req.query.dryRun === "1";
    if (!req.file) {
      res.status(400).json({ error: "File is required" });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const isCsv =
      req.file.mimetype === "text/csv" || req.file.originalname.toLowerCase().endsWith(".csv");
    try {
      if (isCsv) {
        await workbook.csv.read(Readable.from(req.file.buffer));
      } else {
        await workbook.xlsx.load(req.file.buffer as unknown as ArrayBuffer);
      }
    } catch {
      res.status(400).json({ error: "File tidak dapat dibaca. Gunakan format .xlsx atau .csv." });
      return;
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      res.status(400).json({ error: "File kosong atau tidak memiliki baris data." });
      return;
    }

    // Map header row → field keys.
    const keyByCol = new Map<number, string>();
    sheet.getRow(1).eachCell((cell, col) => {
      const key = headerToKey(cell.text);
      if (key) keyByCol.set(col, key);
    });
    if (!keyByCol.size) {
      res.status(400).json({ error: "Baris pertama harus berupa judul kolom (mis. Nama Lengkap, NIK, ...)." });
      return;
    }

    // Cache cabor lookup by normalized (whitespace-collapsed, lowercased) name.
    const caborList = await prisma.cabangOlahraga.findMany({ select: { id: true, nama: true } });
    const caborNames = caborList.map((c) => c.nama);
    const caborByName = new Map(caborList.map((c) => [normalizeName(c.nama), c.id]));
    const caborNameById = new Map(caborList.map((c) => [c.id, c.nama]));

    type PreviewRow = {
      row: number;
      namaLengkap: string;
      nik: string;
      cabor: string;
      jenisKelamin: string;
      statusAtlet: string;
      error?: string;
    };
    type Candidate = {
      row: number;
      data: Prisma.AtletUncheckedCreateInput;
      preview: PreviewRow;
      duplicate?: boolean;
    };

    const rejected: { row: number; error: string; issue: string }[] = [];
    const preview: PreviewRow[] = [];
    const candidates: Candidate[] = [];
    // Within-file duplicate tracking for the unique columns → first row seen.
    const seenNik = new Map<string, number>();
    const seenInduk = new Map<string, number>();
    const seenReg = new Map<string, number>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const raw: Record<string, string> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const key = keyByCol.get(col);
        if (key) raw[key] = cell.text.trim();
      });
      if (!Object.values(raw).some((v) => v !== "")) continue; // skip blank rows

      const reject = (issue: string, error: string) => {
        rejected.push({ row: rowNumber, error, issue });
        preview.push({
          row: rowNumber,
          namaLengkap: raw.namaLengkap ?? "",
          nik: raw.nik ?? "",
          cabor: raw.cabor ?? "",
          jenisKelamin: raw.jenisKelamin ?? "",
          statusAtlet: raw.statusAtlet ?? "",
          error,
        });
      };

      // Resolve cabor: ADMIN_CABOR always imports into their own cabor.
      let cabangOlahragaId = req.scopedCaborId;
      if (!cabangOlahragaId) {
        cabangOlahragaId = raw.cabor ? caborByName.get(normalizeName(raw.cabor)) : undefined;
        if (!cabangOlahragaId) {
          const suggestion = suggestCabor(raw.cabor ?? "", caborNames);
          reject(
            "Nama cabang olahraga tidak ditemukan",
            `Cabang olahraga "${raw.cabor ?? ""}" tidak ditemukan` +
              (suggestion ? `. Mungkin maksud Anda "${suggestion}"?` : ""),
          );
          continue;
        }
      }

      const jenisKelamin = parseGender(raw.jenisKelamin ?? "");
      if (!jenisKelamin) {
        reject("Jenis kelamin tidak valid", "Jenis kelamin harus L atau P");
        continue;
      }
      const statusAtlet = parseStatus(raw.statusAtlet ?? "");
      if (!statusAtlet) {
        reject("Status tidak valid", `Status "${raw.statusAtlet}" tidak dikenal (Aktif/Tidak Aktif)`);
        continue;
      }

      const parsed = importRowSchema.safeParse({
        nomorIndukAtlet: raw.nomorIndukAtlet,
        nomorRegistrasi: raw.nomorRegistrasi,
        namaLengkap: raw.namaLengkap,
        nik: raw.nik,
        jenisKelamin,
        alamat: raw.alamat,
        kecamatan: raw.kecamatan || undefined,
        nomorHp: raw.nomorHp || undefined,
        email: raw.email || undefined,
        statusAtlet,
        pendidikan: raw.pendidikan || undefined,
        pekerjaan: raw.pekerjaan || undefined,
      });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        reject("Data tidak valid", `${first.path.join(".")}: ${first.message}`);
        continue;
      }

      // Reject rows that duplicate an earlier row in the same file.
      const firstDupRow =
        seenNik.get(parsed.data.nik) ??
        seenInduk.get(parsed.data.nomorIndukAtlet) ??
        seenReg.get(parsed.data.nomorRegistrasi);
      if (firstDupRow !== undefined) {
        const label = seenNik.has(parsed.data.nik)
          ? "NIK"
          : seenInduk.has(parsed.data.nomorIndukAtlet)
            ? "Nomor induk"
            : "Nomor registrasi";
        reject("Duplikat dalam berkas", `${label} duplikat dengan baris ${firstDupRow} dalam berkas`);
        continue;
      }
      seenNik.set(parsed.data.nik, rowNumber);
      seenInduk.set(parsed.data.nomorIndukAtlet, rowNumber);
      seenReg.set(parsed.data.nomorRegistrasi, rowNumber);

      candidates.push({
        row: rowNumber,
        data: { ...parsed.data, cabangOlahragaId },
        preview: {
          row: rowNumber,
          namaLengkap: parsed.data.namaLengkap,
          nik: parsed.data.nik,
          cabor: caborNameById.get(cabangOlahragaId) ?? "",
          jenisKelamin,
          statusAtlet,
        },
      });
    }

    // Reject rows whose unique fields already exist in the database.
    if (candidates.length) {
      const existing = await prisma.atlet.findMany({
        where: {
          OR: [
            { nik: { in: candidates.map((c) => c.data.nik) } },
            { nomorIndukAtlet: { in: candidates.map((c) => c.data.nomorIndukAtlet) } },
            { nomorRegistrasi: { in: candidates.map((c) => c.data.nomorRegistrasi) } },
          ],
        },
        select: { nik: true, nomorIndukAtlet: true, nomorRegistrasi: true },
      });
      const existNik = new Set(existing.map((e) => e.nik));
      const existInduk = new Set(existing.map((e) => e.nomorIndukAtlet));
      const existReg = new Set(existing.map((e) => e.nomorRegistrasi));
      for (const c of candidates) {
        const label = existNik.has(c.data.nik)
          ? "NIK"
          : existInduk.has(c.data.nomorIndukAtlet)
            ? "Nomor induk"
            : existReg.has(c.data.nomorRegistrasi)
              ? "Nomor registrasi"
              : null;
        if (label) {
          c.duplicate = true;
          rejected.push({ row: c.row, error: `${label} sudah terdaftar di sistem`, issue: "Sudah terdaftar di sistem" });
          preview.push({ ...c.preview, error: `${label} sudah terdaftar di sistem` });
        }
      }
    }

    const toCreate = candidates.filter((c) => !c.duplicate);
    for (const c of toCreate) preview.push(c.preview);
    preview.sort((a, b) => a.row - b.row);

    // Group the problems by issue type so users get a fix-list (what to fix,
    // how many rows, and a few concrete examples) rather than a flat row dump.
    const summaryMap = new Map<string, { count: number; examples: string[] }>();
    for (const r of rejected) {
      const entry = summaryMap.get(r.issue) ?? { count: 0, examples: [] };
      entry.count += 1;
      if (entry.examples.length < 3) entry.examples.push(`Baris ${r.row}: ${r.error}`);
      summaryMap.set(r.issue, entry);
    }
    const summary = [...summaryMap.entries()]
      .map(([issue, v]) => ({ issue, count: v.count, examples: v.examples }))
      .sort((a, b) => b.count - a.count);

    if (dryRun) {
      res.json({ rows: preview, valid: toCreate.length, invalid: rejected.length, summary });
      return;
    }

    // All-or-nothing: any problem rejects the entire upload — nothing is written.
    if (rejected.length > 0) {
      res.status(400).json({
        error: `Impor ditolak: ${rejected.length} baris bermasalah. Perbaiki lalu unggah ulang.`,
        rejected,
        summary,
      });
      return;
    }

    try {
      await prisma.$transaction(toCreate.map((c) => prisma.atlet.create({ data: c.data })));
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Sebagian data menjadi duplikat saat impor. Coba lagi." });
        return;
      }
      throw err;
    }

    if (toCreate.length > 0) emit("atlet:change");
    res.json({ imported: toCreate.length, rejected: [] });
  }),
);
