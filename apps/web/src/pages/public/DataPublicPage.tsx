import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Medal as MedalIcon, UserCog, Users } from "lucide-react";
import {
  ATHLETE_LEVEL_LABELS,
  ATHLETE_STATUS_LABELS,
  competitionLevelLabel,
  GENDER_LABELS,
  MEDAL_LABELS,
  type AthleteLevel,
  type AthleteStatus,
  type CompetitionLevel,
  type Gender,
  type Medal,
} from "@inasportdb/shared-types";
import { Badge, Card, DataTable, Pagination, Select, type Column } from "../../components/ui";
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

interface RekapMedaliRow {
  cabangOlahragaId: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

const PAGE_SIZE = 20;
const MEDALI_TAHUN_OPTIONS = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => new Date().getFullYear() - i);

type SubMenu = "atlet" | "tenaga" | "medali";

/** Public "Data" menu (revisi 2026-07-12): athlete data (censored names) +
 * statistics, with a "Tenaga Olahraga" submenu for coach data (uncensored). */
export function DataPublicPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialMenu: SubMenu = tabParam === "tenaga" || tabParam === "medali" ? tabParam : "atlet";

  const [stats, setStats] = useState<PublicStats | null>(null);
  const [menu, setMenuState] = useState<SubMenu>(initialMenu);
  function setMenu(next: SubMenu) {
    setMenuState(next);
    setSearchParams(next === "atlet" ? {} : { tab: next }, { replace: true });
  }

  const [atlet, setAtlet] = useState<PublicAtlet[] | null>(null);
  const [atletTotal, setAtletTotal] = useState(0);
  const [atletPage, setAtletPage] = useState(1);

  const [pelatih, setPelatih] = useState<PublicPelatih[] | null>(null);
  const [pelatihTotal, setPelatihTotal] = useState(0);
  const [pelatihPage, setPelatihPage] = useState(1);

  const [medali, setMedali] = useState<RekapMedaliRow[] | null>(null);
  const [medaliTahun, setMedaliTahun] = useState("");

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

  useEffect(() => {
    setMedali(null);
    api
      .get<RekapMedaliRow[]>("/public/rekap-medali", { params: { tahun: medaliTahun || undefined } })
      .then((res) => setMedali([...res.data].sort((a, b) => b.total - a.total)))
      .catch(() => setMedali([]));
  }, [medaliTahun]);

  // Mobile shows Nama + Cabor; the rest collapses behind the chevron
  // (client note 2026-07-12 — "for data, focus on name and cabor").
  const atletColumns: Column<PublicAtlet>[] = [
    {
      key: "nama",
      label: "Nama",
      mobile: true,
      render: (a) => <span className="font-medium text-neutral-900">{a.nama}</span>,
    },
    { key: "cabor", label: "Cabor", mobile: true, render: (a) => <span className="text-neutral-600">{a.cabor}</span> },
    {
      key: "jenisKelamin",
      label: "Jenis Kelamin",
      render: (a) => <span className="text-neutral-600">{GENDER_LABELS[a.jenisKelamin]}</span>,
    },
    {
      key: "tingkat",
      label: "Tingkat",
      mobile: true,
      render: (a) => <span className="text-neutral-600">{a.tingkatAtlet ? ATHLETE_LEVEL_LABELS[a.tingkatAtlet] : "-"}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (a) => (
        <Badge tone={a.statusAtlet === "ACTIVE" ? "success" : "neutral"}>{ATHLETE_STATUS_LABELS[a.statusAtlet]}</Badge>
      ),
    },
    {
      key: "prestasi",
      label: "Prestasi Tertinggi",
      render: (a) =>
        a.prestasiTertinggi ? (
          <span className="flex flex-wrap items-center gap-1.5 text-neutral-600">
            {a.prestasiTertinggi.medali !== "NONE" && (
              <span className={`text-xs font-bold ${MEDAL_TEXT[a.prestasiTertinggi.medali]}`}>
                {MEDAL_LABELS[a.prestasiTertinggi.medali]}
              </span>
            )}
            <span className="text-xs">
              {a.prestasiTertinggi.namaKejuaraan} · {competitionLevelLabel(a.prestasiTertinggi.tingkatKejuaraan)}{" "}
              {a.prestasiTertinggi.tahun}
            </span>
          </span>
        ) : null,
    },
  ];

  const pelatihColumns: Column<PublicPelatih>[] = [
    {
      key: "nama",
      label: "Nama",
      mobile: true,
      render: (p) => <span className="font-medium text-neutral-900">{p.nama}</span>,
    },
    { key: "cabor", label: "Cabor", mobile: true, render: (p) => <span className="text-neutral-600">{p.cabor}</span> },
    {
      key: "lisensi",
      label: "Tingkatan Lisensi",
      render: (p) => <span className="text-neutral-600">{p.tingkatanLisensi ?? "-"}</span>,
    },
    {
      key: "masaBerlaku",
      label: "Masa Berlaku",
      render: (p) => (
        <span className="text-neutral-600">
          {p.masaBerlakuAkhir
            ? new Date(p.masaBerlakuAkhir).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })
            : "-"}
        </span>
      ),
    },
  ];

  const medaliColumns: Column<RekapMedaliRow>[] = [
    {
      key: "nama",
      label: "Cabang Olahraga",
      mobile: true,
      render: (r) => (
        <Link to={`/cabang-olahraga/${r.cabangOlahragaId}`} className="font-medium text-primary hover:underline">
          {r.nama}
        </Link>
      ),
    },
    {
      key: "gold",
      label: <MedalHeader tone={MEDAL_TEXT.GOLD} label="Emas" />,
      mobile: true,
      render: (r) => <span className={MEDAL_TEXT.GOLD}>{r.gold}</span>,
    },
    {
      key: "silver",
      label: <MedalHeader tone={MEDAL_TEXT.SILVER} label="Perak" />,
      render: (r) => <span className={MEDAL_TEXT.SILVER}>{r.silver}</span>,
    },
    {
      key: "bronze",
      label: <MedalHeader tone={MEDAL_TEXT.BRONZE} label="Perunggu" />,
      render: (r) => <span className={MEDAL_TEXT.BRONZE}>{r.bronze}</span>,
    },
    { key: "total", label: "Total", mobile: true, render: (r) => <span className="font-semibold text-neutral-900">{r.total}</span> },
  ];

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
            { key: "medali", label: "Medali" },
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
          {atlet === null ? (
            <Card className="text-sm text-neutral-500">Memuat data...</Card>
          ) : (
            <DataTable columns={atletColumns} rows={atlet} emptyMessage="Belum ada data atlet." />
          )}
          <div className="mt-3">
            <Pagination page={atletPage} pageSize={PAGE_SIZE} total={atletTotal} onPageChange={setAtletPage} />
          </div>
        </>
      )}

      {menu === "tenaga" && (
        <>
          {pelatih === null ? (
            <Card className="text-sm text-neutral-500">Memuat data...</Card>
          ) : (
            <DataTable columns={pelatihColumns} rows={pelatih} emptyMessage="Belum ada data pelatih." />
          )}
          <div className="mt-3">
            <Pagination page={pelatihPage} pageSize={PAGE_SIZE} total={pelatihTotal} onPageChange={setPelatihPage} />
          </div>
        </>
      )}

      {menu === "medali" && (
        <>
          <div className="mb-3 flex justify-end">
            <Select
              value={medaliTahun}
              onChange={setMedaliTahun}
              options={[{ value: "", label: "Semua Tahun" }, ...MEDALI_TAHUN_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))]}
              className="w-40"
            />
          </div>
          {medali === null ? (
            <Card className="text-sm text-neutral-500">Memuat data...</Card>
          ) : (
            <DataTable columns={medaliColumns} rows={medali.map((r) => ({ ...r, id: r.cabangOlahragaId }))} emptyMessage="Belum ada perolehan medali." />
          )}
        </>
      )}
    </PublicShell>
  );
}

function MedalHeader({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <MedalIcon size={13} className={tone} /> {label}
    </span>
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
