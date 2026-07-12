import { useEffect, useState } from "react";
import { Building2, Medal as MedalIcon, UserCog, Users } from "lucide-react";
import {
  ATHLETE_LEVEL_LABELS,
  ATHLETE_STATUS_LABELS,
  COMPETITION_LEVEL_LABELS,
  GENDER_LABELS,
  MEDAL_LABELS,
  type AthleteLevel,
  type AthleteStatus,
  type CompetitionLevel,
  type Gender,
  type Medal,
} from "@inasportdb/shared-types";
import { Card, Pagination } from "../../components/ui";
import { api } from "../../lib/api";
import { PublicShell } from "./PublicShell";

interface PublicStats {
  caborCount: number;
  activeAtletCount: number;
  pelatihCount: number;
  medals: { GOLD: number; SILVER: number; BRONZE: number };
}

interface PublicAtlet {
  id: string;
  nama: string;
  jenisKelamin: Gender;
  statusAtlet: AthleteStatus;
  tingkatAtlet: AthleteLevel | null;
  kecamatan: string | null;
  cabor: string;
  prestasiTertinggi: {
    namaKejuaraan: string;
    tingkatKejuaraan: CompetitionLevel;
    medali: Medal;
    tahun: number;
  } | null;
}

interface PublicPelatih {
  id: string;
  nama: string;
  tingkatanLisensi: string | null;
  masaBerlakuAkhir: string | null;
  cabor: string;
}

// Plain colored text — public pages carry no badge pills (client note 2026-07-12).
const MEDAL_TEXT: Record<Medal, string> = {
  GOLD: "text-gold",
  SILVER: "text-silver",
  BRONZE: "text-bronze",
  NONE: "text-neutral-500",
};

const PAGE_SIZE = 20;

type SubMenu = "atlet" | "tenaga";

/** Public "Data" menu (revisi 2026-07-12): athlete data (censored names) +
 * statistics, with a "Tenaga Olahraga" submenu for coach data (uncensored). */
export function DataPublicPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [menu, setMenu] = useState<SubMenu>("atlet");

  const [atlet, setAtlet] = useState<PublicAtlet[] | null>(null);
  const [atletTotal, setAtletTotal] = useState(0);
  const [atletPage, setAtletPage] = useState(1);

  const [pelatih, setPelatih] = useState<PublicPelatih[] | null>(null);
  const [pelatihTotal, setPelatihTotal] = useState(0);
  const [pelatihPage, setPelatihPage] = useState(1);

  useEffect(() => {
    api.get<PublicStats>("/public/stats").then((res) => setStats(res.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    setAtlet(null);
    api
      .get<{ items: PublicAtlet[]; total: number }>("/public/atlet", {
        params: { page: atletPage, pageSize: PAGE_SIZE },
      })
      .then((res) => {
        setAtlet(res.data.items);
        setAtletTotal(res.data.total);
      })
      .catch(() => setAtlet([]));
  }, [atletPage]);

  useEffect(() => {
    setPelatih(null);
    api
      .get<{ items: PublicPelatih[]; total: number }>("/public/pelatih", {
        params: { page: pelatihPage, pageSize: PAGE_SIZE },
      })
      .then((res) => {
        setPelatih(res.data.items);
        setPelatihTotal(res.data.total);
      })
      .catch(() => setPelatih([]));
  }, [pelatihPage]);

  return (
    <PublicShell title="Data & Statistik" description="Data atlet, tenaga olahraga, dan statistik KONI Batam">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCell icon={Users} label="Atlet Aktif" value={stats?.activeAtletCount} />
        <StatCell icon={Building2} label="Cabang Olahraga" value={stats?.caborCount} />
        <StatCell icon={UserCog} label="Pelatih" value={stats?.pelatihCount} />
        <StatCell
          icon={MedalIcon}
          label="Total Medali"
          value={stats ? stats.medals.GOLD + stats.medals.SILVER + stats.medals.BRONZE : undefined}
        />
      </div>

      {/* Submenu */}
      <div className="mt-6 mb-4 flex gap-1 border-b border-neutral-200">
        {(
          [
            { key: "atlet", label: "Atlet" },
            { key: "tenaga", label: "Tenaga Olahraga" },
          ] as { key: SubMenu; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setMenu(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              menu === t.key
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {menu === "atlet" && (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Cabor</th>
                  <th className="px-4 py-3">Jenis Kelamin</th>
                  <th className="px-4 py-3">Tingkat</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prestasi Tertinggi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {atlet === null ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-400">Memuat data...</td></tr>
                ) : atlet.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-400">Belum ada data atlet.</td></tr>
                ) : (
                  atlet.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{a.nama}</td>
                      <td className="px-4 py-3 text-neutral-600">{a.cabor}</td>
                      <td className="px-4 py-3 text-neutral-600">{GENDER_LABELS[a.jenisKelamin]}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {a.tingkatAtlet ? ATHLETE_LEVEL_LABELS[a.tingkatAtlet] : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold uppercase tracking-wide ${
                            a.statusAtlet === "ACTIVE" ? "text-success" : "text-neutral-500"
                          }`}
                        >
                          {ATHLETE_STATUS_LABELS[a.statusAtlet]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.prestasiTertinggi ? (
                          <span className="flex flex-wrap items-center gap-1.5 text-neutral-600">
                            <span className={`text-xs font-bold ${MEDAL_TEXT[a.prestasiTertinggi.medali]}`}>
                              {MEDAL_LABELS[a.prestasiTertinggi.medali]}
                            </span>
                            <span className="text-xs">
                              {a.prestasiTertinggi.namaKejuaraan} ·{" "}
                              {COMPETITION_LEVEL_LABELS[a.prestasiTertinggi.tingkatKejuaraan]} {a.prestasiTertinggi.tahun}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
          <div className="mt-3">
            <Pagination page={atletPage} pageSize={PAGE_SIZE} total={atletTotal} onPageChange={setAtletPage} />
          </div>
        </>
      )}

      {menu === "tenaga" && (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Cabor</th>
                  <th className="px-4 py-3">Tingkatan Lisensi</th>
                  <th className="px-4 py-3">Masa Berlaku</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pelatih === null ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-400">Memuat data...</td></tr>
                ) : pelatih.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-400">Belum ada data pelatih.</td></tr>
                ) : (
                  pelatih.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{p.nama}</td>
                      <td className="px-4 py-3 text-neutral-600">{p.cabor}</td>
                      <td className="px-4 py-3 text-neutral-600">{p.tingkatanLisensi ?? "-"}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {p.masaBerlakuAkhir
                          ? new Date(p.masaBerlakuAkhir).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
          <div className="mt-3">
            <Pagination page={pelatihPage} pageSize={PAGE_SIZE} total={pelatihTotal} onPageChange={setPelatihPage} />
          </div>
        </>
      )}
    </PublicShell>
  );
}

function StatCell({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | undefined }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-xl font-semibold text-neutral-900">{value ?? "—"}</p>
      </div>
    </Card>
  );
}
