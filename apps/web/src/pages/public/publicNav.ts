import { BERITA_ENABLED } from "../../lib/featureFlags";

/** Landing/public navbar menus (revisi 2026-07-12). */
export const PUBLIC_NAV = [
  { to: "/", label: "Beranda" },
  { to: "/data", label: "Data" },
  { to: "/cabang-olahraga", label: "Cabor" },
  { to: "/medali/event", label: "Medali" }, // TODO: temporary — point back to /medali after PON/Porprov event wraps up
  ...(BERITA_ENABLED ? [{ to: "/berita", label: "Berita" }] : []),
  { to: "/event", label: "Kalender Event" },
];
