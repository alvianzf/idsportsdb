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

    // Cache cabor lookup by lowercase name.
    const caborList = await prisma.cabangOlahraga.findMany({ select: { id: true, nama: true } });
    const caborByName = new Map(caborList.map((c) => [c.nama.toLowerCase(), c.id]));
    const caborNameById = new Map(caborList.map((c) => [c.id, c.nama]));

    let imported = 0;
    const rejected: { row: number; error: string }[] = [];
    const preview: {
      row: number;
      namaLengkap: string;
      nik: string;
      cabor: string;
      jenisKelamin: string;
      statusAtlet: string;
      error?: string;
    }[] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const raw: Record<string, string> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const key = keyByCol.get(col);
        if (key) raw[key] = cell.text.trim();
      });
      if (!Object.values(raw).some((v) => v !== "")) continue; // skip blank rows

      const reject = (error: string) => {
        rejected.push({ row: rowNumber, error });
        if (dryRun) {
          preview.push({
            row: rowNumber,
            namaLengkap: raw.namaLengkap ?? "",
            nik: raw.nik ?? "",
            cabor: raw.cabor ?? "",
            jenisKelamin: raw.jenisKelamin ?? "",
            statusAtlet: raw.statusAtlet ?? "",
            error,
          });
        }
      };

      // Resolve cabor: ADMIN_CABOR always imports into their own cabor.
      let cabangOlahragaId = req.scopedCaborId;
      if (!cabangOlahragaId) {
        cabangOlahragaId = raw.cabor ? caborByName.get(raw.cabor.toLowerCase()) : undefined;
        if (!cabangOlahragaId) {
          reject(`Cabang olahraga "${raw.cabor ?? ""}" tidak ditemukan`);
          continue;
        }
      }

      const jenisKelamin = parseGender(raw.jenisKelamin ?? "");
      if (!jenisKelamin) {
        reject("Jenis kelamin harus L atau P");
        continue;
      }
      const statusAtlet = parseStatus(raw.statusAtlet ?? "");
      if (!statusAtlet) {
        reject(`Status "${raw.statusAtlet}" tidak dikenal (Aktif/Tidak Aktif)`);
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
        reject(`${first.path.join(".")}: ${first.message}`);
        continue;
      }

      if (dryRun) {
        preview.push({
          row: rowNumber,
          namaLengkap: parsed.data.namaLengkap,
          nik: parsed.data.nik,
          cabor: caborNameById.get(cabangOlahragaId) ?? "",
          jenisKelamin,
          statusAtlet,
        });
        imported++;
        continue;
      }

      try {
        await prisma.atlet.create({ data: { ...parsed.data, cabangOlahragaId } });
        imported++;
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          rejected.push({ row: rowNumber, error: "Nomor induk, nomor registrasi, atau NIK sudah digunakan" });
          continue;
        }
        throw err;
      }
    }

    if (dryRun) {
      res.json({ rows: preview, valid: imported, invalid: rejected.length });
      return;
    }

    if (imported > 0) emit("atlet:change");
    res.json({ imported, rejected });
  }),
);
