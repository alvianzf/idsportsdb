import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, Search, Trash2, Upload } from "lucide-react";
import {
  ATHLETE_STATUSES,
  ATHLETE_STATUS_LABELS,
  BATAM_KECAMATAN,
  DATA_ADMIN_ROLES,
  UNSCOPED_ADMIN_ROLES,
  type AthleteStatus,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Input, Select, Badge, Pagination, Combobox, DataTable, Modal, type Column, type BulkAction } from "../../components/ui";
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; rejected: { row: number; error: string }[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  // Revisi 2026-07-12: bulk download to Excel/CSV/PDF (replaces card ZIP).
  async function handleExport(format: "xlsx" | "csv" | "pdf") {
    setShowExportMenu(false);
    const exporting = toast.loading("Menyiapkan berkas...");
    try {
      const res = await api.get("/atlet/export", {
        params: {
          format,
          search: search || undefined,
          cabor: cabor || undefined,
          status: status || undefined,
          kecamatan: kecamatan || undefined,
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `data-atlet.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Data atlet berhasil diunduh.", { id: exporting });
    } catch {
      toast.error("Gagal mengunduh data atlet.", { id: exporting });
    }
  }

  // Revisi 2026-07-12: bulk update — import athletes from an uploaded Excel/CSV.
  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<{ imported: number; rejected: { row: number; error: string }[] }>(
        "/atlet/import",
        form,
      );
      setImportResult(res.data);
      if (res.data.imported > 0) setReloadKey((k) => k + 1);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(typeof message === "string" ? message : "Gagal mengimpor berkas.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
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
    ...(canDelete ? [{ label: "Hapus", icon: Trash2, variant: "danger" as const, onClick: handleBulkDelete }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Data Atlet"
        description="Daftar atlet binaan KONI Batam"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Button variant="outline" onClick={() => setShowExportMenu((v) => !v)}>
                <Download size={16} /> Unduh
              </Button>
              {showExportMenu && (
                <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
                  {(["xlsx", "csv", "pdf"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => handleExport(f)}
                      className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      {f === "xlsx" ? "Excel (.xlsx)" : f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {canCreate && (
              <>
                <Button variant="outline" disabled={importing} onClick={() => importInputRef.current?.click()}>
                  <Upload size={16} /> {importing ? "Mengimpor..." : "Impor"}
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                />
                <Link to="/atlet/new">
                  <Button>
                    <Plus size={16} /> Tambah
                  </Button>
                </Link>
              </>
            )}
          </div>
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

      {importResult && (
        <Modal title="Hasil Impor" onClose={() => setImportResult(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-neutral-700">
              <span className="font-semibold text-success">{importResult.imported}</span> atlet berhasil diimpor
              {importResult.rejected.length > 0 && (
                <>
                  , <span className="font-semibold text-danger">{importResult.rejected.length}</span> baris ditolak
                </>
              )}
              .
            </p>
            {importResult.rejected.length > 0 && (
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                {importResult.rejected.map((r) => (
                  <li key={`${r.row}-${r.error}`}>
                    <span className="font-medium">Baris {r.row}:</span> {r.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
