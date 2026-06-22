import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import {
  ATHLETE_STATUSES,
  ATHLETE_STATUS_LABELS,
  BATAM_KECAMATAN,
  DATA_ADMIN_ROLES,
  UNSCOPED_ADMIN_ROLES,
  type AthleteStatus,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Input, Select, Badge, Pagination, Combobox, DataTable, type Column, type BulkAction } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { confirmAction } from "../../lib/confirm";
import toast from "react-hot-toast";

interface AtletRow {
  id: string;
  namaLengkap: string;
  nomorIndukAtlet: string;
  nomorRegistrasi: string;
  jenisKelamin: string;
  statusAtlet: AthleteStatus;
  kecamatan: string | null;
  cabangOlahraga: { id: string; nama: string };
  caborTambahan: { cabangOlahraga: { id: string; nama: string } }[];
}

interface CaborOption {
  id: string;
  nama: string;
}

const STATUS_TONE: Record<AthleteStatus, "success" | "danger" | "warning" | "info" | "neutral"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  INJURED: "danger",
  TRAINING_CAMP: "info",
  TRANSFERRED: "warning",
};

/** Module B — Data Atlet list. See specs/004-atlet/spec.md. */
export function AtletListPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canCreate = role && DATA_ADMIN_ROLES.includes(role);
  const canDelete = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const isUnscopedAdmin = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [items, setItems] = useState<AtletRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [cabor, setCabor] = useState("");
  const [status, setStatus] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [page, setPage] = useState(1);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dlState, setDlState] = useState<{ count: number; bytes: number } | null>(null);

  const pageSize = 20;

  useEffect(() => {
    if (isUnscopedAdmin) {
      api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
    }
  }, [isUnscopedAdmin]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api
      .get("/atlet", {
        params: {
          search: search || undefined,
          cabor: cabor || undefined,
          status: status || undefined,
          kecamatan: kecamatan || undefined,
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
  }, [search, cabor, status, kecamatan, page, reloadKey]);

  async function handleBulkDelete(ids: string[]) {
    const confirmed = await confirmAction({
      text: `Hapus ${ids.length} atlet? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/atlet/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} atlet berhasil dihapus.`);
    } else {
      toast.error(`${failed} dari ${ids.length} atlet gagal dihapus.`);
    }
    setReloadKey((k) => k + 1);
  }

  async function handleBulkDownloadKartu(ids: string[]) {
    setDlState({ count: ids.length, bytes: 0 });
    try {
      const res = await api.post("/cards/bulk-download", { ids }, {
        responseType: "blob",
        onDownloadProgress: (e) => setDlState({ count: ids.length, bytes: e.loaded }),
      });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "kartu-atlet-bulk.zip";
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${ids.length} kartu berhasil diunduh.`);
    } catch {
      toast.error("Gagal mengunduh kartu. Pastikan atlet yang dipilih memiliki kartu aktif.");
    } finally {
      setDlState(null);
    }
  }

  const columns: Column<AtletRow>[] = [
    {
      key: "namaLengkap",
      label: "Nama",
      mobile: true,
      sortable: true,
      getValue: (a) => a.namaLengkap,
      render: (a) => (
        <Link to={`/atlet/${a.id}`} className="font-medium text-primary hover:underline">
          {a.namaLengkap}
        </Link>
      ),
    },
    {
      key: "cabor",
      label: "Cabor",
      mobile: true,
      sortable: true,
      getValue: (a) => a.cabangOlahraga.nama,
      render: (a) => (
        <span className="text-neutral-600">
          {a.cabangOlahraga.nama}
          {a.caborTambahan.length > 0 && (
            <span className="text-neutral-400">
              {" "}
              +{a.caborTambahan.map((c) => c.cabangOlahraga.nama).join(", ")}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "nomorRegistrasi",
      label: "No. Registrasi",
      sortable: true,
      getValue: (a) => a.nomorRegistrasi,
      render: (a) => <span className="text-neutral-600">{a.nomorRegistrasi}</span>,
    },
    {
      key: "kecamatan",
      label: "Kecamatan",
      sortable: true,
      getValue: (a) => a.kecamatan ?? "",
      render: (a) => <span className="text-neutral-600">{a.kecamatan ?? "-"}</span>,
    },
    {
      key: "statusAtlet",
      label: "Status",
      mobile: true,
      sortable: true,
      getValue: (a) => a.statusAtlet,
      render: (a) => <Badge tone={STATUS_TONE[a.statusAtlet]}>{ATHLETE_STATUS_LABELS[a.statusAtlet]}</Badge>,
    },
  ];

  const bulkActions: BulkAction[] = [
    { label: "Unduh Kartu", icon: Download, variant: "outline", onClick: handleBulkDownloadKartu },
    ...(canDelete ? [{ label: "Hapus", icon: Trash2, variant: "danger" as const, onClick: handleBulkDelete }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Data Atlet"
        description="Daftar atlet binaan KONI Batam"
        actions={
          canCreate ? (
            <Link to="/atlet/new">
              <Button>
                <Plus size={16} /> Tambah
              </Button>
            </Link>
          ) : undefined
        }
      />

      <Card className="mb-4 space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Cari nama, NIK, atau nomor registrasi..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-2">
          {isUnscopedAdmin && (
            <Combobox
              value={cabor}
              onChange={(v) => { setPage(1); setCabor(v); }}
              options={[{ value: "", label: "Semua Cabor" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
              placeholder="Semua Cabor"
              className="w-full"
            />
          )}
          <Select
            value={status}
            onChange={(v) => { setPage(1); setStatus(v); }}
            options={[{ value: "", label: "Semua Status" }, ...ATHLETE_STATUSES.map((s) => ({ value: s, label: ATHLETE_STATUS_LABELS[s] }))]}
            className="w-full"
          />
          <Select
            value={kecamatan}
            onChange={(v) => { setPage(1); setKecamatan(v); }}
            options={[{ value: "", label: "Semua Kecamatan" }, ...BATAM_KECAMATAN.map((k) => ({ value: k, label: k }))]}
            className="w-full"
          />
        </div>
      </Card>

      {error && <Card className="text-sm text-danger">Gagal memuat data.</Card>}

      {items === null ? (
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : (
        <>
          <DataTable columns={columns} rows={items} bulkActions={bulkActions} emptyMessage="Belum ada data atlet." />
          <div className="mt-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </>
      )}

      {dlState && <BulkDownloadOverlay count={dlState.count} bytes={dlState.bytes} />}
    </div>
  );
}

function BulkDownloadOverlay({ count, bytes }: { count: number; bytes: number }) {
  const kb = (bytes / 1024).toFixed(0);
  return (
    <>
      <style>{`
        @keyframes koni-indeterminate {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        .koni-indeterminate {
          animation: koni-indeterminate 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mengunduh kartu"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      >
        <div className="w-full max-w-xs rounded-xl bg-white p-6 shadow-xl">
          <p className="mb-1 text-sm font-semibold text-neutral-900">
            Menyiapkan {count} kartu...
          </p>
          <p className="mb-4 text-xs text-neutral-500">
            {bytes > 0 ? `${kb} KB diunduh` : "Sedang diproses di server"}
          </p>

          {/* Indeterminate progress track */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className="koni-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-primary" />
          </div>

          <p className="mt-4 text-center text-xs text-neutral-400">
            Mohon jangan tutup halaman ini
          </p>
        </div>
      </div>
    </>
  );
}
