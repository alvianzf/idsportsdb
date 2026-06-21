import { useEffect, useRef, useState } from "react";
import { Users, UserCog, Building2, Trophy, Medal } from "lucide-react";
import { MEDAL_LABELS, type Medal as MedalType } from "@inasportdb/shared-types";
import { Card, PageHeader, Badge } from "../components/ui";
import { api } from "../lib/api";
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
  atletCount: number;
  pelatihCount: number;
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

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [perCabor, setPerCabor] = useState<PerCaborStat[] | null>(null);
  const [prestasiStats, setPrestasiStats] = useState<PrestasiStat[] | null>(null);
  const [error, setError] = useState(false);

  const loadRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const requests: [
          Promise<{ data: DashboardSummary }>,
          Promise<{ data: PerCaborStat[] }> | Promise<null>,
          Promise<{ data: PrestasiStat[] }>,
        ] = [
          api.get<DashboardSummary>("/dashboard/summary", { params: { tahun: selectedYear } }),
          isUnscopedAdmin
            ? api.get<PerCaborStat[]>("/dashboard/stats/per-cabor")
            : Promise.resolve(null),
          api.get<PrestasiStat[]>("/dashboard/stats/prestasi", { params: { groupBy: "medali" } }),
        ];

        const [summaryRes, perCaborRes, prestasiRes] = await Promise.all(requests);
        if (cancelled) return;

        setSummary(summaryRes.data);
        setPerCabor(perCaborRes?.data ?? null);
        setPrestasiStats(prestasiRes.data);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    loadRef.current = load;
    load();
    return () => {
      cancelled = true;
    };
  }, [isUnscopedAdmin, selectedYear]);

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

      <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2">
        {isUnscopedAdmin && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Statistik Atlet per Cabor</h2>
            {perCabor === null ? (
              <p className="text-sm text-neutral-500">Memuat data...</p>
            ) : perCabor.length === 0 ? (
              <p className="text-sm text-neutral-500">Belum ada cabang olahraga.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {perCabor.map((c) => (
                  <li key={c.cabangOlahragaId} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-neutral-700">{c.nama}</span>
                    <span className="text-neutral-500">
                      {c.atletCount} atlet &middot; {c.pelatihCount} pelatih
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
            <Medal size={18} />
          </div>
          <div className="w-full">
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">Statistik Prestasi (Medali)</h2>
            {prestasiStats === null ? (
              <p className="text-sm text-neutral-500">Memuat data...</p>
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
    </div>
  );
}
