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
