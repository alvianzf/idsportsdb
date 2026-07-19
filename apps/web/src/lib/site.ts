/**
 * Site identity. SIMO is the application; KONI Batam is the organisation that
 * operates it. Keep these in sync with apps/web/index.html (static SEO tags).
 */
export const SITE = {
  /** App name, used as the visible brand in UI chrome. */
  name: "SIMO",
  /** What the acronym stands for. */
  longName: "Sistem Informasi Manajemen Olahraga",
  /** Organisation operating the app. */
  operator: "KONI Batam",
} as const;

/** Document title for a page: "Data Atlet — SIMO | KONI Batam". */
export function pageTitle(pageName?: string): string {
  const brand = `${SITE.name} | ${SITE.operator}`;
  return pageName ? `${pageName} — ${brand}` : `${SITE.name} — ${SITE.longName} | ${SITE.operator}`;
}
