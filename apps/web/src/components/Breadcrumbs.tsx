import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

/** Segment → label. Unknown segments (UUIDs, slugs) render as "Detail". */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  atlet: "Atlet",
  pelatih: "Pelatih",
  cabor: "Cabang Olahraga",
  prestasi: "Prestasi",
  monitoring: "Monitoring",
  events: "Kalender Event",
  reports: "Pelaporan",
  artikel: "Pengumuman",
  slider: "Slider Beranda",
  users: "Pengguna",
  me: "Profil Saya",
  new: "Tambah",
  edit: "Edit",
  rekam: "Rekam Jejak",
  "atlet-per-cabor": "Atlet per Cabor",
  "atlet-per-usia": "Atlet per Usia",
  "atlet-per-kecamatan": "Atlet per Kecamatan",
  "rekap-medali": "Rekap Medali",
};

export function Breadcrumbs({ homeTo }: { homeTo: string }) {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  // Nothing to orient on the home page itself
  if (segments.length === 0 || pathname === homeTo) return null;

  const crumbs = segments.map((segment, i) => ({
    to: `/${segments.slice(0, i + 1).join("/")}`,
    label: SEGMENT_LABELS[segment] ?? "Detail",
  }));

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-0.5 overflow-x-auto whitespace-nowrap text-xs">
      <Link
        to={homeTo}
        aria-label="Beranda"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary"
      >
        <Home size={13} />
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.to} className="flex shrink-0 items-center gap-0.5">
            <ChevronRight size={12} className="text-neutral-300" />
            {isLast ? (
              <span
                aria-current="page"
                className="rounded-full bg-gradient-to-r from-[#990000] to-[#d92626] px-2.5 py-1 font-semibold text-white shadow-sm"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.to}
                className="rounded-full px-2 py-1 font-medium text-neutral-500 transition-colors hover:bg-primary-50 hover:text-primary"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
