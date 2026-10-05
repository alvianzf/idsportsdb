import type { Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { streamPdf, drawPdfTable, dateLabelWib, type PdfMeta } from "../../lib/pdf.js";

/** specs/025-medali-event-adhoc/spec.md — at most one MedaliEvent ever
 * exists; this is the single source of truth for "is there a current one". */
export function getCurrentEvent() {
  return prisma.medaliEvent.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      kontingen: {
        orderBy: { nama: "asc" },
        include: {
          tallies: { include: { cabangOlahraga: { select: { id: true, nama: true } } } },
        },
      },
      cabors: {
        orderBy: { cabangOlahraga: { nama: "asc" } },
        include: { cabangOlahraga: { select: { id: true, nama: true } } },
      },
    },
  });
}

type EventWithKontingen = NonNullable<Awaited<ReturnType<typeof getCurrentEvent>>>;
type RawTally = EventWithKontingen["kontingen"][number]["tallies"][number];

interface PaddedTally {
  tallyId: string | null;
  cabangOlahragaId: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
}

/** One row per cabor *registered to the event*, not just per existing
 * (sparse) tally row — a registered cabor with no tally shows up as an
 * explicit 0/0/0 instead of being invisible. Any tally for a cabor that
 * was since unregistered is still appended, so recorded medals are never
 * silently dropped. */
function padKontingenTallies(registeredCabors: { id: string; nama: string }[], tallies: RawTally[]): PaddedTally[] {
  const byCaborId = new Map(tallies.map((t) => [t.cabangOlahragaId, t]));
  const registeredIds = new Set(registeredCabors.map((c) => c.id));

  const padded = registeredCabors.map((c) => {
    const t = byCaborId.get(c.id);
    return {
      tallyId: t?.id ?? null,
      cabangOlahragaId: c.id,
      nama: c.nama,
      gold: t?.gold ?? 0,
      silver: t?.silver ?? 0,
      bronze: t?.bronze ?? 0,
    };
  });
  const orphans = tallies
    .filter((t) => !registeredIds.has(t.cabangOlahragaId))
    .map((t) => ({
      tallyId: t.id,
      cabangOlahragaId: t.cabangOlahragaId,
      nama: t.cabangOlahraga.nama,
      gold: t.gold,
      silver: t.silver,
      bronze: t.bronze,
    }));
  return [...padded, ...orphans];
}

/** Admin shape: same `kontingen[].tallies[]` the UI already renders, just
 * padded so every registered cabor has a row (editable straight to 0). */
export function padEventForAdmin(event: EventWithKontingen) {
  const registeredCabors = event.cabors.map((c) => c.cabangOlahraga);
  return {
    ...event,
    kontingen: event.kontingen.map((k) => ({
      ...k,
      tallies: padKontingenTallies(registeredCabors, k.tallies).map((p) => ({
        id: p.tallyId ?? `virtual-${k.id}-${p.cabangOlahragaId}`,
        cabangOlahragaId: p.cabangOlahragaId,
        cabangOlahraga: { id: p.cabangOlahragaId, nama: p.nama },
        gold: p.gold,
        silver: p.silver,
        bronze: p.bronze,
      })),
    })),
  };
}

/** specs/025-medali-event-adhoc/spec.md §3.1 — the public payload. Every
 * kontingen, Batam (`isOwn`) included, is entered the same manual way — this
 * is a separate ad-hoc record, not derived from Prestasi. Batam sorts first,
 * the rest by total descending. */
export function buildPublicPayload(event: EventWithKontingen) {
  const registeredCabors = event.cabors.map((c) => c.cabangOlahraga);

  const kontingen = event.kontingen
    .map((k) => {
      const caborTally = padKontingenTallies(registeredCabors, k.tallies)
        .map((p) => ({
          cabangOlahragaId: p.cabangOlahragaId,
          nama: p.nama,
          gold: p.gold,
          silver: p.silver,
          bronze: p.bronze,
          total: p.gold + p.silver + p.bronze,
        }))
        // Per-cabor tally tables sort by medal rank, not total: gold, then
        // silver, then bronze, each descending.
        .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
      const gold = caborTally.reduce((s, c) => s + c.gold, 0);
      const silver = caborTally.reduce((s, c) => s + c.silver, 0);
      const bronze = caborTally.reduce((s, c) => s + c.bronze, 0);
      return {
        id: k.id,
        nama: k.nama,
        isOwn: k.isOwn,
        gold,
        silver,
        bronze,
        total: gold + silver + bronze,
        caborTally,
      };
    })
    .sort((a, b) => (a.isOwn === b.isOwn ? b.total - a.total : a.isOwn ? -1 : 1));

  const grandTotal = kontingen.reduce((s, k) => s + k.total, 0);

  // Every cabor registered to the event, regardless of whether any kontingen
  // has a (sparse) tally row for it yet — lets the public "Per Cabor" filter
  // offer a cabor before it has a single medal recorded.
  const cabors = registeredCabors;

  return {
    event: {
      id: event.id,
      nama: event.nama,
      tahun: event.tahun,
      tingkatKejuaraan: event.tingkatKejuaraan,
      logoUrl: event.logoUrl,
    },
    kontingen,
    cabors,
    grandTotal,
  };
}

type PublicPayload = ReturnType<typeof buildPublicPayload>;

/** Every registered cabor, summed across all Kabupaten/Kota, sorted the
 * same gold>silver>bronze way as every other tally table — the "Cabor
 * List" section of the printed tally and the public overview table. */
export function buildCaborOverview(payload: PublicPayload) {
  const totals = new Map<string, { nama: string; gold: number; silver: number; bronze: number }>();
  for (const c of payload.cabors) totals.set(c.id, { nama: c.nama, gold: 0, silver: 0, bronze: 0 });
  for (const k of payload.kontingen) {
    for (const c of k.caborTally) {
      const t = totals.get(c.cabangOlahragaId);
      if (t) { t.gold += c.gold; t.silver += c.silver; t.bronze += c.bronze; }
    }
  }
  return Array.from(totals.values())
    .map((t) => ({ ...t, total: t.gold + t.silver + t.bronze }))
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
}

/** Printed tally: page 1 is the Kontingen (Rekap) leaderboard, page 2+ is
 * the Cabor List overview — always a fresh page, even if the leaderboard
 * leaves room. Shared by the admin and public "print" endpoints. */
export function streamMedaliEventPdf(res: Response, payload: PublicPayload, meta: PdfMeta) {
  const leaderboard = [...payload.kontingen].sort(
    (a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze,
  );
  const caborOverview = buildCaborOverview(payload);
  const title = `Rekap Perolehan Medali — ${payload.event.nama} — ${dateLabelWib()}`;
  // Downloaded filename and the PDF viewer's own window/tab title both
  // match the event's name, not a generic "rekap-medali-event".
  const fileSlug = payload.event.nama.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "rekap-medali-event";

  streamPdf(res, `${fileSlug}.pdf`, (doc) => {
    doc.info.Title = payload.event.nama;
    drawPdfTable(
      doc,
      title,
      [
        { header: "Kontingen", width: 220 },
        { header: "Emas", width: 80 },
        { header: "Perak", width: 80 },
        { header: "Perunggu", width: 80 },
        { header: "Total", width: 80 },
      ],
      leaderboard.map((k) => [k.nama, k.gold, k.silver, k.bronze, k.total]),
    );

    doc.addPage();
    drawPdfTable(
      doc,
      "Daftar Cabang Olahraga",
      [
        { header: "Cabang Olahraga", width: 220 },
        { header: "Emas", width: 80 },
        { header: "Perak", width: 80 },
        { header: "Perunggu", width: 80 },
        { header: "Total", width: 80 },
      ],
      caborOverview.map((c) => [c.nama, c.gold, c.silver, c.bronze, c.total]),
    );
  }, meta);
}
