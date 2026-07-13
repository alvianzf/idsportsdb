import type { CompetitionLevel, Medal } from "@inasportdb/shared-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { atletInCaborFilter } from "../atlet/atlet.service.js";
import type { AtletReportFilters } from "./reports.schema.js";

function atletFilterWhere(filters: AtletReportFilters): Prisma.AtletWhereInput {
  return {
    ...(filters.status ? { statusAtlet: filters.status } : {}),
    ...(filters.jenisKelamin ? { jenisKelamin: filters.jenisKelamin } : {}),
  };
}

/** specs/009-pelaporan/spec.md — report 1: data atlet per cabor. */
export async function getAtletPerCabor(caborId: string | null, filters: AtletReportFilters = {}) {
  const atletWhere = atletFilterWhere(filters);
  const cabors = await prisma.cabangOlahraga.findMany({
    where: caborId ? { id: caborId } : undefined,
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
  });

  // #65: count DISTINCT athletes per cabor (primary OR additional membership),
  // matching the detail sheet's `atletInCaborFilter`, instead of summing
  // memberships — which double-counts multi-cabor athletes.
  return Promise.all(
    cabors.map(async (c) => ({
      cabangOlahragaId: c.id,
      nama: c.nama,
      jumlahAtlet: await prisma.atlet.count({
        where: { ...atletInCaborFilter(c.id), ...atletWhere },
      }),
    })),
  );
}

export function calcAge(birth: Date, now: Date): number {
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age--;
  return age;
}

/** specs/009-pelaporan/spec.md — report 2: data atlet per usia (age buckets). */
export async function getAtletPerUsia(caborId: string | null, bucket: number) {
  const atlets = await prisma.atlet.findMany({
    where: caborId ? atletInCaborFilter(caborId) : undefined,
    select: { tanggalLahir: true },
  });

  const now = new Date();
  const counts = new Map<number, number>();
  for (const a of atlets) {
    // Revisi 2026-07-12: tanggal lahir is optional — skip athletes without one.
    if (!a.tanggalLahir) continue;
    const age = calcAge(a.tanggalLahir, now);
    // #74: guard against future birthdates producing negative ages (and labels
    // like "-5--1"); skip them rather than bucketing.
    if (age < 0) continue;
    const bucketStart = Math.floor(age / bucket) * bucket;
    counts.set(bucketStart, (counts.get(bucketStart) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, count]) => ({ range: `${start}-${start + bucket - 1}`, count }));
}

/** specs/009-pelaporan/spec.md — report 3: data atlet per kecamatan. */
export async function getAtletPerKecamatan(caborId: string | null) {
  const atlets = await prisma.atlet.findMany({
    where: caborId ? atletInCaborFilter(caborId) : undefined,
    select: { kecamatan: true },
  });

  const counts = new Map<string, number>();
  for (const a of atlets) {
    const key = a.kecamatan ?? "Tidak diketahui";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([kecamatan, count]) => ({ kecamatan, count }))
    .sort((a, b) => a.kecamatan.localeCompare(b.kecamatan, "id"));
}

/** Full athlete records for the regulator detail sheets (Excel) and the
 * compact PDF listing. Includes cabor name and the most recent prestasi. */
export function getAtletDetail(caborId: string | null, filters: AtletReportFilters = {}) {
  return prisma.atlet.findMany({
    where: {
      ...(caborId ? atletInCaborFilter(caborId) : {}),
      ...atletFilterWhere(filters),
    },
    include: {
      cabangOlahraga: { select: { nama: true } },
      prestasis: {
        orderBy: { tahun: "desc" },
        take: 1,
        select: { namaKejuaraan: true, tahun: true, medali: true },
      },
    },
    orderBy: [{ cabangOlahraga: { nama: "asc" } }, { namaLengkap: "asc" }],
  });
}

/** specs/009-pelaporan/spec.md — report 4: data pelatih. */
export function getPelatihReport(caborId: string | null) {
  return prisma.pelatih.findMany({
    where: caborId ? { cabangOlahragaId: caborId } : undefined,
    include: { cabangOlahraga: { select: { nama: true } } },
    orderBy: [{ cabangOlahraga: { nama: "asc" } }, { namaPelatih: "asc" }],
  });
}

/** specs/009-pelaporan/spec.md — report 5: data prestasi. */
export function getPrestasiReport(
  caborId: string | null,
  tahun?: number,
  tingkat?: CompetitionLevel,
  medali?: Medal,
) {
  const conditions = [];
  if (caborId) conditions.push(atletInCaborFilter(caborId));
  const where = {
    ...(conditions.length ? { atlet: conditions[0] } : {}),
    ...(tahun ? { tahun } : {}),
    ...(tingkat ? { tingkatKejuaraan: tingkat } : {}),
    ...(medali ? { medali } : {}),
  };

  return prisma.prestasi.findMany({
    where,
    include: { atlet: { select: { namaLengkap: true, cabangOlahraga: { select: { nama: true } } } } },
    orderBy: [{ atlet: { cabangOlahraga: { nama: "asc" } } }, { tahun: "desc" }],
  });
}

/** specs/009-pelaporan/spec.md — report 6: rekap medali (per cabor). */
export async function getRekapMedali(caborId: string | null, tahun?: number) {
  const prestasis = await prisma.prestasi.findMany({
    where: {
      ...(caborId ? { atlet: atletInCaborFilter(caborId) } : {}),
      ...(tahun ? { tahun } : {}),
    },
    select: {
      medali: true,
      atlet: { select: { cabangOlahragaId: true, cabangOlahraga: { select: { nama: true } } } },
    },
  });

  // #59: when scoped/filtered to a cabor, every returned prestasi matched that
  // cabor via primary OR additional membership — attribute the medal to THAT
  // cabor, not the athlete's primary cabor (which leaks/misattributes across
  // cabors for a scoped ADMIN_CABOR).
  const scopedNama = caborId
    ? (await prisma.cabangOlahraga.findUnique({ where: { id: caborId }, select: { nama: true } }))?.nama
    : null;

  const map = new Map<string, { nama: string; gold: number; silver: number; bronze: number }>();
  for (const p of prestasis) {
    // #74: only real medals create rows — cabors whose athletes have only NONE
    // records are omitted instead of showing a 0/0/0/0 row.
    if (p.medali !== "GOLD" && p.medali !== "SILVER" && p.medali !== "BRONZE") continue;
    const key = caborId ?? p.atlet.cabangOlahragaId;
    if (!map.has(key)) {
      const nama = caborId ? (scopedNama ?? p.atlet.cabangOlahraga.nama) : p.atlet.cabangOlahraga.nama;
      map.set(key, { nama, gold: 0, silver: 0, bronze: 0 });
    }
    const entry = map.get(key)!;
    if (p.medali === "GOLD") entry.gold++;
    else if (p.medali === "SILVER") entry.silver++;
    else if (p.medali === "BRONZE") entry.bronze++;
  }

  return Array.from(map.entries())
    .map(([cabangOlahragaId, v]) => ({
      cabangOlahragaId,
      nama: v.nama,
      gold: v.gold,
      silver: v.silver,
      bronze: v.bronze,
      total: v.gold + v.silver + v.bronze,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
