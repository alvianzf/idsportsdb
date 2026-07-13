import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserCog, Building2, Trophy, Medal, ArrowLeftRight, UserPlus, Upload, CalendarPlus, Dumbbell } from "lucide-react";
import { MEDAL_LABELS, DATA_ADMIN_ROLES, type Medal as MedalType } from "@inasportdb/shared-types";
import { Card, PageHeader, Badge } from "../components/ui";
import { api, resolveFileUrl } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";

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

// #73 — dashboard quick action tile linking to a common create/import flow.
function QuickAction({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Users }) {
  return (
    <Link to={to}>
      <Card className="flex items-center gap-3 transition-colors hover:bg-neutral-50">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
          <Icon size={18} />
        </div>
        <span className="text-sm font-medium text-neutral-800">{label}</span>
      </Card>
    </Link>
  );
}

// Per-cabor card — mirrors the landing page's stat-tile look (white rounded-xl
// card + red gradient icon chip). Clickable to the cabor admin page. Shows the
// cabor's national-organisation logo, falling back to a generic sport icon.
function CaborStatCard({ c }: { c: PerCaborStat }) {
  const medals = [
    { label: "Emas", value: c.medals.GOLD, dot: "bg-[#f7b500]" },
    { label: "Perak", value: c.medals.SILVER, dot: "bg-[#9ca3af]" },
    { label: "Perunggu", value: c.medals.BRONZE, dot: "bg-[#c9793a]" },
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
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900 group-hover:text-primary">{c.nama}</p>
          <p className="text-xs font-medium text-neutral-500">
            {c.atletCount} atlet &middot; {c.pelatihCount} pelatih
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-600">
        {medals.map((m) => (
          <span key={m.label} className="flex items-center gap-1.5" title={m.label}>
            <span className={`h-2 w-2 rounded-full ${m.dot}`} />
            <span className="tabular-nums">{m.value}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

const MEDAL_BADGE_TONE: Record<MedalType, "gold" | "silver" | "bronze" | "neutral"> = {
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
  NONE: "neutral",
};

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
            {canManageAtlet && <QuickAction to="/atlet?import=1" label="Impor Atlet" icon={Upload} />}
            {isUnscopedAdmin && <QuickAction to="/events" label="Buat Event" icon={CalendarPlus} />}
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

      {isUnscopedAdmin && (
        <section className="mt-4 md:mt-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Statistik Atlet per Cabor</h2>
          {perCabor === null ? (
            !error && <p className="text-sm text-neutral-500">Memuat data...</p>
          ) : perCabor.length === 0 ? (
            <p className="text-sm text-neutral-500">Belum ada cabang olahraga.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
              {perCabor.map((c) => (
                <CaborStatCard key={c.cabangOlahragaId} c={c} />
              ))}
            </div>
          )}
        </section>
      )}

      <Card className="mt-4 flex items-start gap-3 md:mt-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
          <Medal size={18} />
        </div>
        <div className="w-full">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Statistik Prestasi (Medali)</h2>
          {prestasiStats === null ? (
            !error && <p className="text-sm text-neutral-500">Memuat data...</p>
          ) : prestasiStats.length === 0 ? (
            <p className="text-sm text-neutral-500">Belum ada data prestasi.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {prestasiStats.filter((stat) => stat.key !== "NONE").map((stat) => (
                <Badge key={stat.key} tone={MEDAL_BADGE_TONE[stat.key as MedalType] ?? "neutral"}>
                  {MEDAL_LABELS[stat.key as MedalType] ?? stat.key}: {stat.count}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
