import {
  ATHLETE_LEVEL_LABELS,
  ATHLETE_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  GENDER_LABELS,
  MEDAL_LABELS,
  competitionLevelLabel,
  type AthleteLevel,
  type AthleteStatus,
  type CompetitionLevel,
  type DocumentType,
  type Gender,
  type Medal,
} from "@inasportdb/shared-types";

/**
 * Revisi 2026-07-27: biodata atlet as a one-column, ATS-CV style document —
 * plain section headings and label/value lines, no tables or graphics, so it
 * stays readable when KONI copies text out of it.
 */

export interface BiodataAtlet {
  namaLengkap: string;
  nomorIndukAtlet: string | null;
  nomorRegistrasi: string | null;
  nik: string;
  jenisKelamin: Gender;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  alamat: string;
  kecamatan: string | null;
  nomorHp: string | null;
  email: string | null;
  statusAtlet: AthleteStatus;
  tanggalCedera: Date | null;
  keteranganCedera: string | null;
  tingkatAtlet: AthleteLevel | null;
  pendidikan: string | null;
  pekerjaan: string | null;
  cabangOlahraga: { nama: string };
  caborTambahan: { cabangOlahraga: { nama: string } }[];
  prestasis: {
    namaKejuaraan: string;
    tingkatKejuaraan: CompetitionLevel;
    tahun: number;
    medali: Medal;
    peringkat: number | null;
  }[];
  documents: { type: DocumentType; uploadedAt: Date }[];
}

const TEXT = "#1a1a1a";
const MUTED = "#666666";
const RULE = "#cccccc";

function dateId(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Adds a page when `needed` vertical space doesn't fit below the cursor. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 34);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  // Font before moveDown — the spacing is a multiple of the current line height.
  doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT);
  doc.moveDown(0.8);
  doc.text(title.toUpperCase(), left, doc.y, { characterSpacing: 0.6 });
  const y = doc.y + 2;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(RULE).stroke();
  doc.y = y + 6;
  doc.x = left;
}

/** One "Label   Value" line; the value wraps and can span several lines. */
function fieldRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const left = doc.page.margins.left;
  const labelWidth = 130;
  const valueWidth = doc.page.width - doc.page.margins.right - left - labelWidth;

  doc.font("Helvetica").fontSize(9.5);
  const height = Math.max(13, doc.heightOfString(value || "-", { width: valueWidth }) + 3);
  ensureSpace(doc, height);
  // Re-apply: a page break above runs the footer painter, which leaves the
  // font at its own smaller size.
  doc.font("Helvetica").fontSize(9.5);

  const y = doc.y;
  doc.fillColor(MUTED).text(label, left, y, { width: labelWidth - 8 });
  doc.fillColor(TEXT).text(value || "-", left + labelWidth, y, { width: valueWidth });
  doc.y = y + height;
  doc.x = left;
}

/** Bullet line for the list sections (prestasi, dokumen). */
function bulletLine(doc: PDFKit.PDFDocument, primary: string, secondary?: string) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.right - left - 12;

  doc.font("Helvetica").fontSize(9.5);
  const height =
    doc.heightOfString(primary, { width }) +
    (secondary ? doc.heightOfString(secondary, { width }) : 0) +
    5;
  ensureSpace(doc, height);
  doc.font("Helvetica").fontSize(9.5); // see fieldRow — restore after a page break

  const y = doc.y;
  doc.fillColor(MUTED).text("•", left, y, { lineBreak: false });
  doc.fillColor(TEXT).text(primary, left + 12, y, { width });
  if (secondary) {
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(secondary, left + 12, doc.y, { width });
  }
  doc.y = y + height;
  doc.x = left;
}

export function drawBiodataPdf(doc: PDFKit.PDFDocument, a: BiodataAtlet) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ── Header: name + one-line summary, CV style ─────────────────────
  doc.font("Helvetica-Bold").fontSize(18).fillColor(TEXT);
  doc.text(a.namaLengkap.toUpperCase(), left, doc.y, { width });

  const headline = [
    a.cabangOlahraga.nama,
    a.tingkatAtlet ? `Tingkat ${ATHLETE_LEVEL_LABELS[a.tingkatAtlet]}` : null,
    ATHLETE_STATUS_LABELS[a.statusAtlet],
  ]
    .filter(Boolean)
    .join("  •  ");
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(headline, { width });

  const contact = [a.nomorHp, a.email, a.kecamatan ? `Kec. ${a.kecamatan}` : null]
    .filter(Boolean)
    .join("  •  ");
  if (contact) doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(contact, { width });

  doc.moveDown(0.4);
  const ruleY = doc.y;
  doc.moveTo(left, ruleY).lineTo(left + width, ruleY).lineWidth(1).strokeColor(TEXT).stroke();
  doc.y = ruleY + 4;

  // ── Identitas ─────────────────────────────────────────────────────
  sectionTitle(doc, "Data Pribadi");
  fieldRow(doc, "NIK", a.nik);
  fieldRow(doc, "Jenis Kelamin", GENDER_LABELS[a.jenisKelamin]);
  if (a.tempatLahir || a.tanggalLahir) {
    fieldRow(doc, "Tempat, Tanggal Lahir", [a.tempatLahir, dateId(a.tanggalLahir)].filter(Boolean).join(", "));
  }
  fieldRow(doc, "Alamat", a.alamat);
  fieldRow(doc, "Kecamatan", a.kecamatan ?? "-");
  fieldRow(doc, "Nomor HP", a.nomorHp ?? "-");
  fieldRow(doc, "Email", a.email ?? "-");
  fieldRow(doc, "Pendidikan Terakhir", a.pendidikan ?? "-");
  fieldRow(doc, "Pekerjaan", a.pekerjaan ?? "-");

  // ── Keolahragaan ──────────────────────────────────────────────────
  sectionTitle(doc, "Data Keolahragaan");
  fieldRow(doc, "Nomor Induk Atlet", a.nomorIndukAtlet ?? "-");
  fieldRow(doc, "Nomor Registrasi", a.nomorRegistrasi ?? "-");
  fieldRow(doc, "Cabang Olahraga", a.cabangOlahraga.nama);
  if (a.caborTambahan.length > 0) {
    fieldRow(doc, "Cabor Tambahan", a.caborTambahan.map((c) => c.cabangOlahraga.nama).join(", "));
  }
  fieldRow(doc, "Tingkat Atlet", a.tingkatAtlet ? ATHLETE_LEVEL_LABELS[a.tingkatAtlet] : "-");
  fieldRow(doc, "Status", ATHLETE_STATUS_LABELS[a.statusAtlet]);
  if (a.statusAtlet === "INJURED") {
    fieldRow(doc, "Tanggal Cedera", dateId(a.tanggalCedera));
    fieldRow(doc, "Keterangan Cedera", a.keteranganCedera ?? "-");
  }

  // ── Prestasi ──────────────────────────────────────────────────────
  sectionTitle(doc, "Prestasi");
  if (a.prestasis.length === 0) {
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("Belum ada data prestasi.", left, doc.y, { width });
  } else {
    for (const p of a.prestasis) {
      const medal = p.medali === "NONE" ? null : `Medali ${MEDAL_LABELS[p.medali]}`;
      const detail = [
        competitionLevelLabel(p.tingkatKejuaraan),
        medal,
        p.peringkat ? `Peringkat ${p.peringkat}` : null,
      ]
        .filter(Boolean)
        .join("  •  ");
      bulletLine(doc, `${p.tahun} — ${p.namaKejuaraan}`, detail);
    }
  }

  // ── Dokumen pendukung ─────────────────────────────────────────────
  sectionTitle(doc, "Dokumen Pendukung");
  if (a.documents.length === 0) {
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("Belum ada dokumen pendukung.", left, doc.y, { width });
  } else {
    for (const d of a.documents) {
      bulletLine(doc, DOCUMENT_TYPE_LABELS[d.type], `Diunggah ${dateId(d.uploadedAt)}`);
    }
  }

  doc.fillColor(TEXT);
}

/** `Biodata-Nama-Atlet.pdf`, safe for a Content-Disposition filename. */
export function biodataFilename(namaLengkap: string): string {
  const slug = namaLengkap
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Biodata-${slug || "Atlet"}.pdf`;
}
