import { prisma } from "../../lib/prisma.js";

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
    },
  });
}

type EventWithKontingen = NonNullable<Awaited<ReturnType<typeof getCurrentEvent>>>;

/** specs/025-medali-event-adhoc/spec.md §3.1 — the public payload. Every
 * kontingen, Batam (`isOwn`) included, is entered the same manual way — this
 * is a separate ad-hoc record, not derived from Prestasi. Batam sorts first,
 * the rest by total descending. */
export function buildPublicPayload(event: EventWithKontingen) {
  const kontingen = event.kontingen
    .map((k) => {
      const caborTally = k.tallies.map((t) => ({
        cabangOlahragaId: t.cabangOlahragaId,
        nama: t.cabangOlahraga.nama,
        gold: t.gold,
        silver: t.silver,
        bronze: t.bronze,
        total: t.gold + t.silver + t.bronze,
      }));
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

  return {
    event: {
      id: event.id,
      nama: event.nama,
      tahun: event.tahun,
      tingkatKejuaraan: event.tingkatKejuaraan,
      logoUrl: event.logoUrl,
    },
    kontingen,
    grandTotal,
  };
}
