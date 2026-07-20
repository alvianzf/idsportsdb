/**
 * Display order for pengurus cabor (client direction 2026-07-20), applied to
 * both the public Cabor page and the dashboard cabor detail.
 *
 * `jabatan` is free text, so match on a normalised prefix — "Ketua Bidang
 * Pembinaan" ranks as "ketua bidang". Anything unlisted sorts last, keeping
 * whatever order the caller's query already applied (usually by name).
 */
const JABATAN_ORDER = [
  "ketua umum",
  "ketua harian",
  "sekretaris",
  "bendahara",
  "ketua bidang",
  "ketua seksi",
  "anggota",
];

export function jabatanRank(jabatan: string): number {
  const normalised = jabatan.trim().toLowerCase();
  const index = JABATAN_ORDER.findIndex((j) => normalised.startsWith(j));
  return index === -1 ? JABATAN_ORDER.length : index;
}

/** Stable sort by jabatan rank — ties keep the input order. */
export function sortByJabatan<T extends { jabatan: string }>(pengurus: T[]): T[] {
  return [...pengurus].sort((a, b) => jabatanRank(a.jabatan) - jabatanRank(b.jabatan));
}
