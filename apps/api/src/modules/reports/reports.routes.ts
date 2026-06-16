import { Router } from "express";
import { MEDAL_LABELS, COMPETITION_LEVEL_LABELS } from "@inasportdb/shared-types";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authenticate, requireRole, scopeToCabor } from "../../middleware/auth.js";
import { streamPdf, drawPdfTable } from "../../lib/pdf.js";
import { streamExcel } from "../../lib/excel.js";
import {
  baseReportQuerySchema,
  atletPerUsiaQuerySchema,
  pelatihReportQuerySchema,
  prestasiReportQuerySchema,
  rekapMedaliQuerySchema,
} from "./reports.schema.js";
import {
  getAtletPerCabor,
  getAtletPerUsia,
  getAtletPerKecamatan,
  getPelatihReport,
  getPrestasiReport,
  getRekapMedali,
} from "./reports.service.js";

export const reportsRouter = Router();

reportsRouter.use(
  authenticate,
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  scopeToCabor,
);

// specs/009-pelaporan/spec.md — report 1
reportsRouter.get(
  "/atlet-per-cabor",
  asyncHandler(async (req, res) => {
    const parsed = baseReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const data = await getAtletPerCabor(req.scopedCaborId ?? null);

    if (parsed.data.format === "json") {
      res.json(data);
      return;
    }
    if (parsed.data.format === "excel") {
      await streamExcel(
        res,
        "atlet-per-cabor.xlsx",
        "Atlet per Cabor",
        [
          { header: "Cabang Olahraga", key: "nama", width: 30 },
          { header: "Jumlah Atlet", key: "jumlahAtlet", width: 15 },
        ],
        data,
      );
      return;
    }
    streamPdf(res, "atlet-per-cabor.pdf", (doc) => {
      drawPdfTable(
        doc,
        "Data Atlet per Cabang Olahraga",
        [
          { header: "Cabang Olahraga", width: 350 },
          { header: "Jumlah Atlet", width: 120 },
        ],
        data.map((d) => [d.nama, d.jumlahAtlet]),
      );
    });
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
    if (parsed.data.format === "excel") {
      await streamExcel(
        res,
        "atlet-per-usia.xlsx",
        "Atlet per Usia",
        [
          { header: "Rentang Usia", key: "range", width: 20 },
          { header: "Jumlah Atlet", key: "count", width: 15 },
        ],
        data,
      );
      return;
    }
    streamPdf(res, "atlet-per-usia.pdf", (doc) => {
      drawPdfTable(
        doc,
        "Data Atlet per Usia",
        [
          { header: "Rentang Usia", width: 200 },
          { header: "Jumlah Atlet", width: 120 },
        ],
        data.map((d) => [d.range, d.count]),
      );
    });
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
    if (parsed.data.format === "excel") {
      await streamExcel(
        res,
        "atlet-per-kecamatan.xlsx",
        "Atlet per Kecamatan",
        [
          { header: "Kecamatan", key: "kecamatan", width: 25 },
          { header: "Jumlah Atlet", key: "count", width: 15 },
        ],
        data,
      );
      return;
    }
    streamPdf(res, "atlet-per-kecamatan.pdf", (doc) => {
      drawPdfTable(
        doc,
        "Data Atlet per Kecamatan",
        [
          { header: "Kecamatan", width: 250 },
          { header: "Jumlah Atlet", width: 120 },
        ],
        data.map((d) => [d.kecamatan, d.count]),
      );
    });
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
    if (parsed.data.format === "excel") {
      await streamExcel(
        res,
        "data-pelatih.xlsx",
        "Data Pelatih",
        [
          { header: "Nama Pelatih", key: "namaPelatih", width: 25 },
          { header: "Cabang Olahraga", key: "cabor", width: 25 },
          { header: "Nomor Lisensi", key: "nomorLisensi", width: 20 },
          { header: "Tingkatan Lisensi", key: "tingkatanLisensi", width: 20 },
        ],
        data.map((p) => ({
          namaPelatih: p.namaPelatih,
          cabor: p.cabangOlahraga.nama,
          nomorLisensi: p.nomorLisensi,
          tingkatanLisensi: p.tingkatanLisensi,
        })),
      );
      return;
    }
    streamPdf(res, "data-pelatih.pdf", (doc) => {
      drawPdfTable(
        doc,
        "Data Pelatih",
        [
          { header: "Nama Pelatih", width: 150 },
          { header: "Cabang Olahraga", width: 150 },
          { header: "Nomor Lisensi", width: 100 },
          { header: "Tingkatan", width: 90 },
        ],
        data.map((p) => [p.namaPelatih, p.cabangOlahraga.nama, p.nomorLisensi, p.tingkatanLisensi]),
      );
    });
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
    if (parsed.data.format === "excel") {
      await streamExcel(
        res,
        "data-prestasi.xlsx",
        "Data Prestasi",
        [
          { header: "Atlet", key: "atlet", width: 25 },
          { header: "Cabang Olahraga", key: "cabor", width: 25 },
          { header: "Kejuaraan", key: "kejuaraan", width: 30 },
          { header: "Tingkat", key: "tingkat", width: 18 },
          { header: "Tahun", key: "tahun", width: 10 },
          { header: "Medali", key: "medali", width: 12 },
          { header: "Peringkat", key: "peringkat", width: 12 },
        ],
        data.map((p) => ({
          atlet: p.atlet.namaLengkap,
          cabor: p.atlet.cabangOlahraga.nama,
          kejuaraan: p.namaKejuaraan,
          tingkat: COMPETITION_LEVEL_LABELS[p.tingkatKejuaraan],
          tahun: p.tahun,
          medali: MEDAL_LABELS[p.medali],
          peringkat: p.peringkat ?? "-",
        })),
      );
      return;
    }
    streamPdf(res, "data-prestasi.pdf", (doc) => {
      drawPdfTable(
        doc,
        "Data Prestasi Atlet",
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
    });
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
    if (parsed.data.format === "excel") {
      await streamExcel(
        res,
        "rekap-medali.xlsx",
        "Rekap Medali",
        [
          { header: "Cabang Olahraga", key: "nama", width: 25 },
          { header: "Emas", key: "gold", width: 10 },
          { header: "Perak", key: "silver", width: 10 },
          { header: "Perunggu", key: "bronze", width: 10 },
          { header: "Total", key: "total", width: 10 },
        ],
        data,
      );
      return;
    }
    streamPdf(res, "rekap-medali.pdf", (doc) => {
      drawPdfTable(
        doc,
        "Rekap Medali per Cabang Olahraga",
        [
          { header: "Cabang Olahraga", width: 220 },
          { header: "Emas", width: 60 },
          { header: "Perak", width: 60 },
          { header: "Perunggu", width: 60 },
          { header: "Total", width: 60 },
        ],
        data.map((d) => [d.nama, d.gold, d.silver, d.bronze, d.total]),
      );
    });
  }),
);
