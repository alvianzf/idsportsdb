import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, UserCog, Building2, Trophy, Medal, ArrowLeftRight, UserPlus, Upload, CalendarPlus, Dumbbell } from "lucide-react";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Badge, SearchInput } from "../components/ui";
import { api, resolveFileUrl } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";
import { AtletImportModal } from "./atlet/AtletImportModal";
import { EventFormModal } from "./event/EventFormModal";

interface DashboardSummary {
  activeAtletCount: number;
  pelatihCount: number;
  caborCount: number;
  prestasiCount: number;
  prestasiCountAll: number;
  tahun: number;
}

interface PerCaborStat {
  cabangOlahragaId: string;
  nama: string;
  logoOrganisasiUrl: string | null;
  atletCount: number;
  pelatihCount: number;
  medals: { GOLD: number; SILVER: number; BRONZE: number };
}

interface PrestasiStat {
  key: string;
  count: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof Users;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-xl font-semibold text-neutral-900">{value}</p>
      </div>
    </Card>
  );
}

// #73 — dashboard quick action tile for a common create/import flow. Actions
// that open a modal pass `onClick` instead of `to`, so the flow starts here
// rather than routing away first (see the import/event modals below).
function QuickAction({
  to,
  onClick,
  label,
  icon: Icon,
}: {
  to?: string;
  onClick?: () => void;
  label: string;
  icon: typeof Users;
}) {
  const tile = (
    <Card className="flex cursor-pointer items-center gap-3 transition-colors hover:border-primary/40 hover:bg-primary-50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Icon size={18} />
      </div>
      <span className="text-sm font-medium text-neutral-800">{label}</span>
    </Card>
  );
  return to ? <Link to={to}>{tile}</Link> : <div onClick={onClick}>{tile}</div>;
}

// Per-cabor card — mirrors the landing page's stat-tile look (white rounded-xl
// card + red gradient icon chip). Clickable to the cabor admin page. Shows the
// cabor's national-organisation logo, falling back to a generic sport icon.
function CaborStatCard({ c }: { c: PerCaborStat }) {
  const medals = [
    { label: "Emas", value: c.medals.GOLD, color: "text-[#f7b500]" },
    { label: "Perak", value: c.medals.SILVER, color: "text-[#9ca3af]" },
    { label: "Perunggu", value: c.medals.BRONZE, color: "text-[#c9793a]" },
  ];
  return (
    <Link
      to={`/cabor/${c.cabangOlahragaId}`}
      className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg shadow-neutral-900/5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        {c.logoOrganisasiUrl ? (
          <img
            src={resolveFileUrl(c.logoOrganisasiUrl)}
            alt={c.nama}
            className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#990000] to-[#d92626] text-white shadow-md shadow-red-900/30">
            <Dumbbell size={20} />
          </div>
        )}
        <p className="min-w-0 truncate font-semibold text-neutral-900 group-hover:text-primary">{c.nama}</p>
      </div>
      {/* Prominent athlete + coach counts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-neutral-50 px-3 py-2">
          <p className="text-2xl font-bold leading-none tabular-nums text-neutral-900">{c.atletCount}</p>
          <p className="mt-1 text-xs font-medium text-neutral-500">Atlet</p>
        </div>
        <div className="rounded-lg bg-neutral-50 px-3 py-2">
          <p className="text-2xl font-bold leading-none tabular-nums text-neutral-900">{c.pelatihCount}</p>
          <p className="mt-1 text-xs font-medium text-neutral-500">Pelatih</p>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-neutral-100 pt-2 text-sm font-semibold text-neutral-700">
        {medals.map((m) => (
          <span key={m.label} className="flex items-center gap-1" title={m.label}>
            <Medal size={16} className={m.color} />
            <span className="tabular-nums">{m.value}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

/** Prominent "Perolehan Medali" totals — one big colored figure + medal icon per medal. */
function MedalTotalsCard({ stats }: { stats: { key: string; count: number }[] | null }) {
  const get = (k: string) => stats?.find((s) => s.key === k)?.count ?? 0;
  const items = [
    { key: "GOLD", label: "Emas", color: "text-[#f7b500]", count: get("GOLD") },
    { key: "SILVER", label: "Perak", color: "text-[#9ca3af]", count: get("SILVER") },
    { key: "BRONZE", label: "Perunggu", color: "text-[#c9793a]", count: get("BRONZE") },
  ];
  return (
    <Card className="mt-4 md:mt-6">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-700">Perolehan Medali</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((m) => (
          <div
            key={m.key}
            className="flex flex-col items-center gap-1 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-5 text-center"
          >
            <Medal size={24} className={m.color} />
            <p className={`text-3xl font-bold leading-none tabular-nums ${m.color}`}>{m.count}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{m.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Per-cabor cards as a searchable 4×4 carousel that auto-advances every 3s. */
function CaborCarousel({ cabors }: { cabors: PerCaborStat[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cabors.filter((c) => c.nama.toLowerCase().includes(q)) : cabors;
  }, [cabors, query]);

  const PER_PAGE = 16; // 4×4
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [query]);

  // Auto-advance every 3s; paused on hover or while searching.
  useEffect(() => {
    if (paused || query || pageCount <= 1) return;
    const timer = setInterval(() => setPage((p) => (p + 1) % pageCount), 3000);
    return () => clearInterval(timer);
  }, [paused, query, pageCount]);

  const pages = useMemo(() => {
    const out: PerCaborStat[][] = [];
    for (let i = 0; i < pageCount; i++) out.push(filtered.slice(i * PER_PAGE, i * PER_PAGE + PER_PAGE));
    return out;
  }, [filtered, pageCount]);

  // The slides sit side by side in one flex track, so the viewport would
  // otherwise stand as tall as the fullest page — leaving a last page of three
  // cards padded out to four rows of empty space. Track the active slide's
  // height instead. Measured rather than computed, since the grid is 1/2/4
  // columns across breakpoints and the cards are not a fixed height.
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [viewportHeight, setViewportHeight] = useState<number>();

  useLayoutEffect(() => {
    const el = slideRefs.current[current];
    if (!el) return;
    const measure = () => setViewportHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [current, pages]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mb-3 max-w-xs">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Cari cabang olahraga..."
          suggestions={cabors.map((c) => c.nama)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">Tidak ada cabor yang cocok.</p>
      ) : (
        <>
          <div
            className="overflow-hidden transition-[height] duration-500 ease-in-out"
            style={{ height: viewportHeight }}
          >
            <div
              className="flex items-start transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {pages.map((chunk, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    slideRefs.current[i] = el;
                  }}
                  className="grid w-full shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4"
                >
                  {chunk.map((c) => (
                    <CaborStatCard key={c.cabangOlahragaId} c={c} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Halaman ${i + 1}`}
                  onClick={() => setPage(i)}
                  className={`h-2 rounded-full transition-all ${i === current ? "w-5 bg-primary" : "w-2 bg-neutral-300 hover:bg-neutral-400"}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Module A — Dashboard Utama. Fetches live counts from
 * GET /dashboard/summary, /dashboard/stats/per-cabor, /dashboard/stats/prestasi.
 * See specs/002-dashboard/spec.md.
 */
export function DashboardPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role === "SUPER_ADMIN_KONI" || role === "ADMIN_KONI";
  const canManageAtlet = role ? DATA_ADMIN_ROLES.includes(role) : false;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [perCabor, setPerCabor] = useState<PerCaborStat[] | null>(null);
  const [prestasiStats, setPrestasiStats] = useState<PrestasiStat[] | null>(null);
  const [pendingMutasi, setPendingMutasi] = useState(0);
  const [error, setError] = useState(false);
  // Quick actions open their form here and only route away once the work
  // succeeds — a failed import/save leaves the user on the dashboard.
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [cabors, setCabors] = useState<{ id: string; nama: string }[]>([]);

  useEffect(() => {
    if (showEventForm && cabors.length === 0) {
      api.get<{ id: string; nama: string }[]>("/cabor").then((res) => setCabors(res.data)).catch(() => undefined);
    }
  }, [showEventForm, cabors.length]);

  const loadRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(false);
      try {
        const { data } = await api.get<{
          summary: DashboardSummary;
          perCabor: PerCaborStat[] | null;
          prestasiStats: PrestasiStat[];
        }>("/dashboard/all", { params: { tahun: selectedYear } });
        if (cancelled) return;

        setSummary(data.summary);
        setPerCabor(data.perCabor);
        setPrestasiStats(data.prestasiStats);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    loadRef.current = load;
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => loadRef.current();
    socket.on("atlet:change", refresh);
    socket.on("prestasi:change", refresh);
    return () => {
      socket.off("atlet:change", refresh);
      socket.off("prestasi:change", refresh);
    };
  }, []);

  // Pending-mutasi count for approvers — surfaces the approval backlog that
  // otherwise piles up silently. Refreshes live on any mutasi decision.
  useEffect(() => {
    if (!isUnscopedAdmin) return;
    let cancelled = false;
    const load = () => {
      api
        .get<{ count: number }>("/monitoring/mutasi/pending-count")
        .then((res) => { if (!cancelled) setPendingMutasi(res.data.count); })
        .catch(() => undefined);
    };
    load();
    const socket = getSocket();
    socket.on("monitoring:change", load);
    return () => {
      cancelled = true;
      socket.off("monitoring:change", load);
    };
  }, [isUnscopedAdmin]);

  const yearOptions = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Ringkasan data atlet, pelatih, dan cabang olahraga KONI Batam"
      />

      {error && (
        <Card className="mb-4 text-sm text-danger">
          Gagal memuat data dashboard. Coba muat ulang halaman.
        </Card>
      )}

      {isUnscopedAdmin && pendingMutasi > 0 && (
        <Link to="/monitoring" className="mb-4 block">
          <Card className="flex items-center gap-4 border-warning/30 bg-warning-light/50 transition-colors hover:bg-warning-light">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-warning">
              <ArrowLeftRight size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-neutral-900">Mutasi Menunggu Persetujuan</p>
              <p className="text-xs text-neutral-600">
                {pendingMutasi} permohonan mutasi atlet perlu ditinjau.
              </p>
            </div>
            <Badge tone="warning">{pendingMutasi}</Badge>
          </Card>
        </Link>
      )}

      {(canManageAtlet || isUnscopedAdmin) && (
        <div className="mb-4">
          <p className="mb-2 text-sm text-neutral-500">Aksi Cepat</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {canManageAtlet && <QuickAction to="/atlet/new" label="Tambah Atlet" icon={UserPlus} />}
            {canManageAtlet && <QuickAction onClick={() => setShowImport(true)} label="Impor Atlet" icon={Upload} />}
            {isUnscopedAdmin && <QuickAction onClick={() => setShowEventForm(true)} label="Buat Event" icon={CalendarPlus} />}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-neutral-500">Data Prestasi</p>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-700 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Atlet Aktif" value={summary?.activeAtletCount ?? "—"} icon={Users} />
        <StatCard label="Pelatih" value={summary?.pelatihCount ?? "—"} icon={UserCog} />
        <StatCard label="Cabang Olahraga" value={summary?.caborCount ?? "—"} icon={Building2} />
        <StatCard
          label={`Prestasi ${selectedYear}`}
          value={summary?.prestasiCount ?? "—"}
          icon={Trophy}
        />
      </div>

      <div className="mt-3">
        <p className="text-xs text-neutral-500">
          Total prestasi semua waktu:{" "}
          <span className="font-semibold text-neutral-900">{summary?.prestasiCountAll ?? "—"}</span>
        </p>
      </div>

      {/* Perolehan Medali — prominent totals, above the per-cabor cards. */}
      <MedalTotalsCard stats={prestasiStats} />

      {isUnscopedAdmin && (
        <section className="mt-4 md:mt-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Statistik Atlet per Cabor</h2>
          {perCabor === null ? (
            !error && <p className="text-sm text-neutral-500">Memuat data...</p>
          ) : perCabor.length === 0 ? (
            <p className="text-sm text-neutral-500">Belum ada cabang olahraga.</p>
          ) : (
            <CaborCarousel cabors={perCabor} />
          )}
        </section>
      )}

      {showImport && (
        <AtletImportModal
          onClose={(imported) => {
            setShowImport(false);
            if (imported > 0) navigate("/atlet");
          }}
        />
      )}

      {showEventForm && (
        <EventFormModal
          event="new"
          cabors={cabors}
          onSaved={() => {
            setShowEventForm(false);
            navigate("/events");
          }}
          onClose={() => setShowEventForm(false)}
        />
      )}
    </div>
  );
}
