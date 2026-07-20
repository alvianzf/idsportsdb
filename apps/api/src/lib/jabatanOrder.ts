import { JABATAN_PENGURUS, type JabatanPengurus } from "@inasportdb/shared-types";

/**
 * Display order for pengurus cabor (client direction 2026-07-20), applied to
 * both the public Cabor page and the dashboard cabor detail.
 *
 * The rank IS the enum's declaration order, so adding a position in
 * `JABATAN_PENGURUS` is the only edit needed to change the ladder.
 */
export function jabatanRank(jabatan: JabatanPengurus): number {
  return JABATAN_PENGURUS.indexOf(jabatan);
}

/** Stable sort by jabatan rank — ties keep the input order (usually by nama). */
export function sortByJabatan<T extends { jabatan: JabatanPengurus }>(pengurus: T[]): T[] {
  return [...pengurus].sort((a, b) => jabatanRank(a.jabatan) - jabatanRank(b.jabatan));
}
