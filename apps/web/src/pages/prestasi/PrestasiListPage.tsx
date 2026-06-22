import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import {
  COMPETITION_LEVELS,
  COMPETITION_LEVEL_LABELS,
  DATA_ADMIN_ROLES,
  MEDALS,
  MEDAL_LABELS,
  UNSCOPED_ADMIN_ROLES,
  type CompetitionLevel,
  type Medal,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Input, Select, Badge, Pagination, Combobox, DataTable, type Column, type BulkAction } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { confirmAction } from "../../lib/confirm";
import toast from "react-hot-toast";

interface PrestasiRow {
  id: string;
  namaKejuaraan: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: number;
  medali: Medal;
  peringkat: number | null;
  atlet: {
    id: string;
    namaLengkap: string;
    cabangOlahragaId: string;
    cabangOlahraga: { id: string; nama: string };
  };
}

interface CaborOption {
  id: string;
  nama: string;
}

const MEDAL_TONE: Record<Medal, "gold" | "silver" | "bronze" | "neutral"> = {
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
  NONE: "neutral",
};

/** Module F — Prestasi Atlet list. See specs/007-prestasi-atlet/spec.md. */
export function PrestasiListPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const canDelete = role && DATA_ADMIN_ROLES.includes(role);

  const [items, setItems] = useState<PrestasiRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cabor, setCabor] = useState("");
  const [tahun, setTahun] = useState("");
  const [tingkat, setTingkat] = useState("");
  const [medali, setMedali] = useState("");
  const [page, setPage] = useState(1);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const pageSize = 20;

  useEffect(() => {
    if (!isUnscopedAdmin) return;
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
  }, [isUnscopedAdmin]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api
      .get("/prestasi", {
        params: {
          cabor: cabor || undefined,
          tahun: tahun || undefined,
          tingkat: tingkat || undefined,
          medali: medali || undefined,
          page,
          pageSize,
        },
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cabor, tahun, tingkat, medali, page, reloadKey]);

  async function handleBulkDelete(ids: string[]) {
    const confirmed = await confirmAction({
      text: `Hapus ${ids.length} prestasi? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/prestasi/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} prestasi berhasil dihapus.`);
    } else {
      toast.error(`${failed} dari ${ids.length} prestasi gagal dihapus.`);
    }
    setReloadKey((k) => k + 1);
  }

  const columns: Column<PrestasiRow>[] = [
    {
      key: "atlet",
      label: "Atlet",
      mobile: true,
      sortable: true,
      getValue: (p) => p.atlet.namaLengkap,
      render: (p) => (
        <Link to={`/atlet/${p.atlet.id}`} className="font-medium text-primary hover:underline">
          {p.atlet.namaLengkap}
        </Link>
      ),
    },
    {
      key: "cabor",
      label: "Cabor",
      mobile: true,
      sortable: true,
      getValue: (p) => p.atlet.cabangOlahraga.nama,
      render: (p) => <span className="text-neutral-600">{p.atlet.cabangOlahraga.nama}</span>,
    },
    {
      key: "medali",
      label: "Hasil",
      mobile: true,
      sortable: true,
      getValue: (p) => p.medali,
      render: (p) => (
        <div className="flex items-center gap-2">
          <Badge tone={MEDAL_TONE[p.medali]}>{MEDAL_LABELS[p.medali]}</Badge>
          {p.peringkat && <span className="text-neutral-500">#{p.peringkat}</span>}
        </div>
      ),
    },
    // Desktop-only columns (collapse to expand row on mobile)
    {
      key: "namaKejuaraan",
      label: "Kejuaraan",
      sortable: true,
      getValue: (p) => p.namaKejuaraan,
      render: (p) => <span className="text-neutral-600">{p.namaKejuaraan}</span>,
    },
    {
      key: "tingkatKejuaraan",
      label: "Tingkat",
      sortable: true,
      getValue: (p) => p.tingkatKejuaraan,
      render: (p) => <span className="text-neutral-600">{COMPETITION_LEVEL_LABELS[p.tingkatKejuaraan]}</span>,
    },
    {
      key: "tahun",
      label: "Tahun",
      sortable: true,
      getValue: (p) => p.tahun,
      render: (p) => <span className="text-neutral-600">{p.tahun}</span>,
    },
  ];

  const bulkActions: BulkAction[] = canDelete
    ? [{ label: "Hapus", icon: Trash2, variant: "danger", onClick: handleBulkDelete }]
    : [];

  return (
    <div>
      <PageHeader title="Prestasi Atlet" description="Daftar prestasi atlet KONI Batam" />

      <Card className="mb-4 flex flex-wrap items-center gap-3">
        {isUnscopedAdmin && (
          <Combobox
            value={cabor}
            onChange={(v) => {
              setPage(1);
              setCabor(v);
            }}
            options={[{ value: "", label: "Semua Cabor" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
            placeholder="Semua Cabor"
            className="w-48"
          />
        )}
        <Select
          value={tingkat}
          onChange={(v) => { setPage(1); setTingkat(v); }}
          options={[{ value: "", label: "Semua Tingkat" }, ...COMPETITION_LEVELS.map((l) => ({ value: l, label: COMPETITION_LEVEL_LABELS[l] }))]}
          className="w-44"
        />
        <Select
          value={medali}
          onChange={(v) => { setPage(1); setMedali(v); }}
          options={[{ value: "", label: "Semua Medali" }, ...MEDALS.map((m) => ({ value: m, label: MEDAL_LABELS[m] }))]}
          className="w-40"
        />
        <Input
          type="number"
          placeholder="Tahun"
          value={tahun}
          onChange={(e) => {
            setPage(1);
            setTahun(e.target.value);
          }}
          className="w-28"
        />
      </Card>

      {error && <Card className="text-sm text-danger">Gagal memuat data.</Card>}

      {items === null ? (
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : (
        <>
          <DataTable columns={columns} rows={items} bulkActions={bulkActions} emptyMessage="Belum ada data prestasi." />
          <div className="mt-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
