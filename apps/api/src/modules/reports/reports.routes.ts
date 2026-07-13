import { Router } from "express";
import {
  MEDAL_LABELS,
  COMPETITION_LEVEL_LABELS,
  GENDER_LABELS,
  ATHLETE_STATUS_LABELS,
  ATHLETE_LEVEL_LABELS,
} from "@inasportdb/shared-types";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { streamPdf, drawPdfTable, dateLabelWib, type PdfMeta } from "../../lib/pdf.js";
import { streamExcel, streamExcelSheets, streamCsv, type ExcelSheetSpec } from "../../lib/excel.js";
import {
  baseReportQuerySchema,
  atletPerCaborQuerySchema,
  atletPerUsiaQuerySchema,
  pelatihReportQuerySchema,
  prestasiReportQuerySchema,
  rekapMedaliQuerySchema,
} from "./reports.schema.js";
import {
  getAtletPerCabor,
  getAtletPerUsia,
  getAtletPerKecamatan,
  getAtletDetail,
  getPelatihReport,
  getPrestasiReport,
  getRekapMedali,
  calcAge,
} from "./reports.service.js";

export const reportsRouter = Router();

type AtletDetailRow = Awaited<ReturnType<typeof getAtletDetail>>[number];

/** Footer credit for report PDFs: "Nama Lengkap (email)". */
async function pdfMeta(userId: string): Promise<PdfMeta> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true },
  });
  return { downloadedBy: user ? `${user.fullName} (${user.email})` : "-" };
}

/** Report title with the download date, e.g. "Data Atlet — 12 Juli 2026". */
function titled(base: string): string {
  return `${base} — ${dateLabelWib()}`;
}

function prestasiTerakhir(a: AtletDetailRow): string {
  const p = a.prestasis[0];
  if (!p) return "-";
  const medali = p.medali !== "NONE" ? ` (${MEDAL_LABELS[p.medali]})` : "";
  // Many kejuaraan names already contain the year — don't repeat it.
  const tahun = p.namaKejuaraan.includes(String(p.tahun)) ? "" : ` ${p.tahun}`;
  return `${p.namaKejuaraan}${tahun}${medali}`;
}

function formatDateId(d: Date | null): string {
  return d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
}

/** Regulator detail sheet — every stored athlete field. */
function atletDetailSheet(atlets: AtletDetailRow[]): ExcelSheetSpec {
  const now = new Date();
  return {
    name: "Data Atlet",
    columns: [
      { header: "Nomor Induk", key: "nomorInduk", width: 15 },
      { header: "Nomor Registrasi", key: "nomorRegistrasi", width: 15 },
      { header: "Nama Lengkap", key: "nama", width: 28 },
      { header: "NIK", key: "nik", width: 20 },
      { header: "Jenis Kelamin", key: "jenisKelamin", width: 14 },
      { header: "Tempat Lahir", key: "tempatLahir", width: 16 },
      { header: "Tanggal Lahir", key: "tanggalLahir", width: 18 },
      { header: "Usia", key: "usia", width: 8 },
      { header: "Alamat", key: "alamat", width: 35 },
      { header: "Kecamatan", key: "kecamatan", width: 16 },
      { header: "Nomor HP", key: "nomorHp", width: 16 },
      { header: "Email", key: "email", width: 24 },
      { header: "Cabang Olahraga", key: "cabor", width: 20 },
      { header: "Status", key: "status", width: 12 },
      { header: "Tingkat", key: "tingkat", width: 14 },
      { header: "Pendidikan", key: "pendidikan", width: 16 },
      { header: "Pekerjaan", key: "pekerjaan", width: 18 },
      { header: "Prestasi Terakhir", key: "prestasi", width: 35 },
    ],
    rows: atlets.map((a) => ({
      nomorInduk: a.nomorIndukAtlet,
      nomorRegistrasi: a.nomorRegistrasi,
      nama: a.namaLengkap,
      nik: a.nik,
      jenisKelamin: GENDER_LABELS[a.jenisKelamin],
      tempatLahir: a.tempatLahir ?? "-",
      tanggalLahir: formatDateId(a.tanggalLahir),
      usia: a.tanggalLahir ? calcAge(a.tanggalLahir, now) : "-",
      alamat: a.alamat,
      kecamatan: a.kecamatan ?? "-",
      nomorHp: a.nomorHp ?? "-",
      email: a.email ?? "-",
      cabor: a.cabangOlahraga.nama,
      status: ATHLETE_STATUS_LABELS[a.statusAtlet],
      tingkat: a.tingkatAtlet ? ATHLETE_LEVEL_LABELS[a.tingkatAtlet] : "-",
      pendidikan: a.pendidikan ?? "-",
      pekerjaan: a.pekerjaan ?? "-",
      prestasi: prestasiTerakhir(a),
    })),
  };
}

/** Compact athlete listing appended to the report PDFs — important fields only. */
function drawAtletDetailPdf(doc: PDFKit.PDFDocument, atlets: AtletDetailRow[]) {
  doc.moveDown(2);
  drawPdfTable(
    doc,
    "Data Atlet",
    [
      { header: "Nama", width: 170 },
      { header: "Cabor", width: 120 },
      { header: "Prestasi Terakhir", width: 225 },
    ],
    atlets.map((a) => [a.namaLengkap, a.cabangOlahraga.nama, prestasiTerakhir(a)]),
  );
}

reportsRouter.use(
  authenticate,
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  scopeToCabor,
);

// specs/009-pelaporan/spec.md — report 1
reportsRouter.get(
  "/atlet-per-cabor",
  asyncHandler(async (req, res) => {
    const parsed = atletPerCaborQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const caborId = req.scopedCaborId ?? parsed.data.cabor ?? null;
    const filters = { status: parsed.data.status, jenisKelamin: parsed.data.jenisKelamin };
    const data = await getAtletPerCabor(caborId, filters);

    if (parsed.data.format === "json") {
      res.json(data);
      return;
    }

    if (parsed.data.format === "csv") {
      await streamCsv(res, "atlet-per-cabor.csv", [
        { header: "Cabang Olahraga", key: "nama", width: 30 },
        { header: "Jumlah Atlet", key: "jumlahAtlet", width: 15 },
      ], data);
      return;
    }
    const atlets = await getAtletDetail(caborId, filters);
    if (parsed.data.format === "excel") {
      await streamExcelSheets(res, "atlet-per-cabor.xlsx", [
        {
          name: "Atlet per Cabor",
          columns: [
            { header: "Cabang Olahraga", key: "nama", width: 30 },
            { header: "Jumlah Atlet", key: "jumlahAtlet", width: 15 },
          ],
          rows: data,
        },
        atletDetailSheet(atlets),
      ]);
      return;
    }
    streamPdf(res, "atlet-per-cabor.pdf", (doc) => {
      drawPdfTable(
        doc,
        titled("Data Atlet per Cabang Olahraga"),
        [
          { header: "Cabang Olahraga", width: 350 },
          { header: "Jumlah Atlet", width: 120 },
        ],
        data.map((d) => [d.nama, d.jumlahAtlet]),
      );
      drawAtletDetailPdf(doc, atlets);
    }, await pdfMeta(req.user!.id));
  }),
);

// specs/009-pelaporan/spec.md — report 2
reportsRouter.get(
  "/atlet-per-usia",
  asyncHandler(async (req, res) => {
    const parsed = atletPerUsiaQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const data = await getAtletPerUsia(req.scopedCaborId ?? null, parsed.data.bucket);

    if (parsed.data.format === "json") {
      res.json(data);
      return;
    }

    if (parsed.data.format === "csv") {
      await streamCsv(res, "atlet-per-usia.csv", [
        { header: "Rentang Usia", key: "range", width: 20 },
        { header: "Jumlah Atlet", key: "count", width: 15 },
      ], data);
      return;
    }
    const atlets = await getAtletDetail(req.scopedCaborId ?? null);
    if (parsed.data.format === "excel") {
      await streamExcelSheets(res, "atlet-per-usia.xlsx", [
        {
          name: "Atlet per Usia",
          columns: [
            { header: "Rentang Usia", key: "range", width: 20 },
            { header: "Jumlah Atlet", key: "count", width: 15 },
          ],
          rows: data,
        },
        atletDetailSheet(atlets),
      ]);
      return;
    }
    streamPdf(res, "atlet-per-usia.pdf", (doc) => {
      drawPdfTable(
        doc,
        titled("Data Atlet per Usia"),
        [
          { header: "Rentang Usia", width: 200 },
          { header: "Jumlah Atlet", width: 120 },
        ],
        data.map((d) => [d.range, d.count]),
      );
      drawAtletDetailPdf(doc, atlets);
    }, await pdfMeta(req.user!.id));
  }),
);

// specs/009-pelaporan/spec.md — report 3
reportsRouter.get(
  "/atlet-per-kecamatan",
  asyncHandler(async (req, res) => {
    const parsed = baseReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const data = await getAtletPerKecamatan(req.scopedCaborId ?? null);

    if (parsed.data.format === "json") {
      res.json(data);
      return;
    }

    if (parsed.data.format === "csv") {
      await streamCsv(res, "atlet-per-kecamatan.csv", [
        { header: "Kecamatan", key: "kecamatan", width: 25 },
        { header: "Jumlah Atlet", key: "count", width: 15 },
      ], data);
      return;
    }
    const atlets = await getAtletDetail(req.scopedCaborId ?? null);
    if (parsed.data.format === "excel") {
      await streamExcelSheets(res, "atlet-per-kecamatan.xlsx", [
        {
          name: "Atlet per Kecamatan",
          columns: [
            { header: "Kecamatan", key: "kecamatan", width: 25 },
            { header: "Jumlah Atlet", key: "count", width: 15 },
          ],
          rows: data,
        },
        atletDetailSheet(atlets),
      ]);
      return;
    }
    streamPdf(res, "atlet-per-kecamatan.pdf", (doc) => {
      drawPdfTable(
        doc,
        titled("Data Atlet per Kecamatan"),
        [
          { header: "Kecamatan", width: 250 },
          { header: "Jumlah Atlet", width: 120 },
        ],
        data.map((d) => [d.kecamatan, d.count]),
      );
      drawAtletDetailPdf(doc, atlets);
    }, await pdfMeta(req.user!.id));
  }),
);

// specs/009-pelaporan/spec.md — report 4
reportsRouter.get(
  "/pelatih",
  asyncHandler(async (req, res) => {
    const parsed = pelatihReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const caborId = req.scopedCaborId ?? parsed.data.cabor ?? null;
    const data = await getPelatihReport(caborId);

    if (parsed.data.format === "json") {
      res.json(data);
      return;
    }
    const pelatihColumns = [
      { header: "Nama Pelatih", key: "namaPelatih", width: 25 },
      { header: "Cabang Olahraga", key: "cabor", width: 25 },
      { header: "Nomor Lisensi", key: "nomorLisensi", width: 20 },
      { header: "Tingkatan Lisensi", key: "tingkatanLisensi", width: 20 },
    ];
    const pelatihRows = data.map((p) => ({
      namaPelatih: p.namaPelatih,
      cabor: p.cabangOlahraga.nama,
      nomorLisensi: p.nomorLisensi,
      tingkatanLisensi: p.tingkatanLisensi,
    }));
    if (parsed.data.format === "csv") {
      await streamCsv(res, "data-pelatih.csv", pelatihColumns, pelatihRows);
      return;
    }
    if (parsed.data.format === "excel") {
      await streamExcel(res, "data-pelatih.xlsx", "Data Pelatih", pelatihColumns, pelatihRows);
      return;
    }
    streamPdf(res, "data-pelatih.pdf", (doc) => {
      drawPdfTable(
        doc,
        titled("Data Pelatih"),
        [
          { header: "Nama Pelatih", width: 150 },
          { header: "Cabang Olahraga", width: 150 },
          { header: "Nomor Lisensi", width: 100 },
          { header: "Tingkatan", width: 90 },
        ],
        data.map((p) => [p.namaPelatih, p.cabangOlahraga.nama, p.nomorLisensi, p.tingkatanLisensi]),
      );
    }, await pdfMeta(req.user!.id));
  }),
);

// specs/009-pelaporan/spec.md — report 5
reportsRouter.get(
  "/prestasi",
  asyncHandler(async (req, res) => {
    const parsed = prestasiReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const data = await getPrestasiReport(
      req.scopedCaborId ?? null,
      parsed.data.tahun,
      parsed.data.tingkat,
      parsed.data.medali,
    );

    if (parsed.data.format === "json") {
      res.json(data);
      return;
    }
    const prestasiColumns = [
      { header: "Atlet", key: "atlet", width: 25 },
      { header: "Cabang Olahraga", key: "cabor", width: 25 },
      { header: "Kejuaraan", key: "kejuaraan", width: 30 },
      { header: "Tingkat", key: "tingkat", width: 18 },
      { header: "Tahun", key: "tahun", width: 10 },
      { header: "Medali", key: "medali", width: 12 },
      { header: "Peringkat", key: "peringkat", width: 12 },
    ];
    const prestasiRows = data.map((p) => ({
      atlet: p.atlet.namaLengkap,
      cabor: p.atlet.cabangOlahraga.nama,
      kejuaraan: p.namaKejuaraan,
      tingkat: COMPETITION_LEVEL_LABELS[p.tingkatKejuaraan],
      tahun: p.tahun,
      medali: MEDAL_LABELS[p.medali],
      peringkat: p.peringkat ?? "-",
    }));
    if (parsed.data.format === "csv") {
      await streamCsv(res, "data-prestasi.csv", prestasiColumns, prestasiRows);
      return;
    }
    if (parsed.data.format === "excel") {
      await streamExcel(res, "data-prestasi.xlsx", "Data Prestasi", prestasiColumns, prestasiRows);
      return;
    }
    streamPdf(res, "data-prestasi.pdf", (doc) => {
      drawPdfTable(
        doc,
        titled("Data Prestasi Atlet"),
        [
          { header: "Atlet", width: 120 },
          { header: "Cabor", width: 100 },
          { header: "Kejuaraan", width: 130 },
          { header: "Tahun", width: 50 },
          { header: "Medali", width: 60 },
        ],
        data.map((p) => [
          p.atlet.namaLengkap,
          p.atlet.cabangOlahraga.nama,
          p.namaKejuaraan,
          p.tahun,
          MEDAL_LABELS[p.medali],
        ]),
      );
    }, await pdfMeta(req.user!.id));
  }),
);

// specs/009-pelaporan/spec.md — report 6
reportsRouter.get(
  "/rekap-medali",
  asyncHandler(async (req, res) => {
    const parsed = rekapMedaliQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const caborId = req.scopedCaborId ?? parsed.data.cabor ?? null;
    const data = await getRekapMedali(caborId, parsed.data.tahun);

    if (parsed.data.format === "json") {
      res.json(data);
      return;
    }
    const rekapColumns = [
      { header: "Cabang Olahraga", key: "nama", width: 25 },
      { header: "Emas", key: "gold", width: 10 },
      { header: "Perak", key: "silver", width: 10 },
      { header: "Perunggu", key: "bronze", width: 10 },
      { header: "Total", key: "total", width: 10 },
    ];
    if (parsed.data.format === "csv") {
      await streamCsv(res, "rekap-medali.csv", rekapColumns, data);
      return;
    }
    if (parsed.data.format === "excel") {
      await streamExcel(res, "rekap-medali.xlsx", "Rekap Medali", rekapColumns, data);
      return;
    }
    streamPdf(res, "rekap-medali.pdf", (doc) => {
      drawPdfTable(
        doc,
        titled("Rekap Medali per Cabang Olahraga"),
        [
          { header: "Cabang Olahraga", width: 220 },
          { header: "Emas", width: 60 },
          { header: "Perak", width: 60 },
          { header: "Perunggu", width: 60 },
          { header: "Total", width: 60 },
        ],
        data.map((d) => [d.nama, d.gold, d.silver, d.bronze, d.total]),
      );
    }, await pdfMeta(req.user!.id));
  }),
);
