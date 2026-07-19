import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pageTitle } from "./site";

/** Route-prefix → page name. Longest matching prefix wins. */
const TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/dashboard", "Dashboard"],
  ["/atlet", "Data Atlet"],
  ["/cabor", "Cabang Olahraga"],
  ["/pelatih", "Pelatih"],
  ["/prestasi", "Prestasi"],
  ["/monitoring", "Monitoring"],
  ["/events", "Event"],
  ["/reports", "Pelaporan"],
  ["/artikel", "Pengumuman"],
  ["/slider", "Slider Beranda"],
  ["/users", "Pengguna"],
  ["/audit", "Riwayat Aktivitas"],
  ["/me", "Profil Saya"],
  ["/login", "Masuk"],
  ["/data", "Data & Statistik"],
  ["/", "Beranda"],
];

/** Page name for a pathname (longest-prefix match), or "" if none. */
export function pageNameFor(pathname: string): string {
  let match: readonly [string, string] | undefined;
  for (const entry of TITLES) {
    const prefix = entry[0];
    const hit = prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (hit && (!match || prefix.length > match[0].length)) match = entry;
  }
  return match ? match[1] : "";
}

/** Sets document.title to "{page name} — SIMO | KONI Batam" for the current route. */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pageTitle(pageNameFor(pathname));
  }, [pathname]);
}
