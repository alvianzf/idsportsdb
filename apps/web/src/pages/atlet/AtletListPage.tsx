import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Download, Pencil, Plus, Tag, Trash2, Upload } from "lucide-react";
import {
  ATHLETE_STATUSES,
  ATHLETE_STATUS_LABELS,
  BATAM_KECAMATAN,
  DATA_ADMIN_ROLES,
  UNSCOPED_ADMIN_ROLES,
  UNSCOPED_VIEW_ROLES,
  type AthleteStatus,
} from "@inasportdb/shared-types";
import { ActionMenu, Card, PageHeader, Button, Select, Badge, Pagination, Combobox, DataTable, Modal, SearchInput, type Column, type BulkAction } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { confirmAction } from "../../lib/confirm";
import { AtletImportModal } from "./AtletImportModal";
import toast from "react-hot-toast";

interface AtletRow {
  id: string;
  namaLengkap: string;
  nomorIndukAtlet: string | null;
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
  RETIRED: "neutral",
};

/** Module B — Data Atlet list. See specs/004-atlet/spec.md. */
export function AtletListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const canCreate = role && DATA_ADMIN_ROLES.includes(role);
  const canDelete = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const isUnscopedAdmin = role && UNSCOPED_VIEW_ROLES.includes(role);
  // #70 — soft-delete recovery. Admins can toggle an archive view and restore;
  // only SUPER_ADMIN can permanently purge.
  const canRestore = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const canHardDelete = role === "SUPER_ADMIN_KONI";
  const [showArchive, setShowArchive] = useState(false);

  const [items, setItems] = useState<AtletRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cabor, setCabor] = useState("");
  const [status, setStatus] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [page, setPage] = useState(1);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // #73 — bulk status change. Selected ids are captured when the action fires,
  // since the DataTable clears its selection right after onClick.
  const [statusTargetIds, setStatusTargetIds] = useState<string[] | null>(null);
  const [bulkStatus, setBulkStatus] = useState<AthleteStatus>("ACTIVE");
  const [savingStatus, setSavingStatus] = useState(false);

  const pageSize = 20;

  useEffect(() => {
    if (isUnscopedAdmin) {
      api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
    }
  }, [isUnscopedAdmin]);

  // Debounce free-text search so typing fires one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(false);
    api
      .get("/atlet", {
        params: {
          search: debouncedSearch || undefined,
          cabor: cabor || undefined,
          status: status || undefined,
          kecamatan: kecamatan || undefined,
          deleted: showArchive || undefined,
          page,
          pageSize,
        },
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setTotal(res.data.total);
        // After a bulk delete the current page can fall out of range (empty page,
        // no pager to escape) — clamp back to the last real page.
        const totalPages = Math.max(1, Math.ceil(res.data.total / pageSize));
        if (page > totalPages) setPage(totalPages);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, cabor, status, kecamatan, showArchive, page, reloadKey]);

  async function handleDeleteOne(a: AtletRow) {
    const confirmed = await confirmAction({
      text: `Hapus atlet ${a.namaLengkap}? Data dipindahkan ke arsip.`,
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/atlet/${a.id}`);
      toast.success("Atlet berhasil dihapus.");
      setReloadKey((k) => k + 1);
    } catch {
      toast.error("Gagal menghapus atlet.");
    }
  }

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

  // #70 — restore archived athletes.
  async function handleRestore(ids: string[]) {
    const results = await Promise.allSettled(ids.map((id) => api.post(`/atlet/${id}/restore`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} atlet berhasil dipulihkan.`);
    } else {
      toast.error(`${failed} dari ${ids.length} atlet gagal dipulihkan.`);
    }
    setReloadKey((k) => k + 1);
  }

  // #70 — permanently purge archived athletes (SUPER_ADMIN only).
  async function handleHardDelete(ids: string[]) {
    const confirmed = await confirmAction({
      text: `Hapus permanen ${ids.length} atlet? Data dan seluruh dokumen/prestasi akan hilang dan tidak dapat dipulihkan.`,
      danger: true,
      confirmText: "Hapus Permanen",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/atlet/${id}/permanent`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} atlet dihapus permanen.`);
    } else {
      toast.error(`${failed} dari ${ids.length} atlet gagal dihapus.`);
    }
    setReloadKey((k) => k + 1);
  }

  function handleBulkStatus(ids: string[]) {
    setBulkStatus("ACTIVE");
    setStatusTargetIds(ids);
  }

  async function submitBulkStatus() {
    if (!statusTargetIds) return;
    setSavingStatus(true);
    try {
      const res = await api.patch<{ updated: number }>("/atlet/bulk-status", {
        ids: statusTargetIds,
        status: bulkStatus,
      });
      toast.success(`Status ${res.data.updated} atlet berhasil diubah.`);
      setStatusTargetIds(null);
      setReloadKey((k) => k + 1);
    } catch {
      toast.error("Gagal mengubah status atlet.");
    } finally {
      setSavingStatus(false);
    }
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

  const columns: Column<AtletRow>[] = [
    {
      key: "namaLengkap",
      label: "Nama",
      mobile: true,
      sortable: true,
      getValue: (a) => a.namaLengkap,
      render: (a) =>
        showArchive ? (
          <span className="font-medium text-neutral-700">{a.namaLengkap}</span>
        ) : (
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
    // Revisi 2026-07-18: row actions in a three-dots dropdown (edit + delete).
    ...(!showArchive && (canCreate || canDelete)
      ? [
          {
            key: "aksi",
            label: "Aksi",
            render: (a) => (
              <ActionMenu
                items={[
                  ...(canCreate
                    ? [{ label: "Edit", icon: Pencil, onClick: () => navigate(`/atlet/${a.id}/edit`) }]
                    : []),
                  ...(canDelete
                    ? [{ label: "Hapus", icon: Trash2, danger: true, onClick: () => handleDeleteOne(a) }]
                    : []),
                ]}
              />
            ),
          } satisfies Column<AtletRow>,
        ]
      : []),
  ];

  const bulkActions: BulkAction[] = showArchive
    ? [
        ...(canRestore ? [{ label: "Pulihkan", icon: ArchiveRestore, variant: "outline" as const, onClick: handleRestore }] : []),
        ...(canHardDelete ? [{ label: "Hapus Permanen", icon: Trash2, variant: "danger" as const, onClick: handleHardDelete }] : []),
      ]
    : [
        ...(canCreate ? [{ label: "Ubah Status", icon: Tag, onClick: handleBulkStatus }] : []),
        ...(canDelete ? [{ label: "Hapus", icon: Trash2, variant: "danger" as const, onClick: handleBulkDelete }] : []),
      ];

  return (
    <div>
      <PageHeader
        title="Data Atlet"
        description="Daftar atlet binaan KONI Batam"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canRestore && (
              <Button variant="outline" onClick={() => { setPage(1); setShowArchive((v) => !v); }}>
                {showArchive ? <><ArchiveRestore size={16} /> Data Aktif</> : <><Archive size={16} /> Arsip</>}
              </Button>
            )}
            {showArchive ? null : (
            <>
            <div className="relative">
              <Button variant="outline" onClick={() => setShowExportMenu((v) => !v)}>
                <Download size={16} /> Unduh
              </Button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
                    {(["xlsx", "csv", "pdf"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => handleExport(f)}
                        className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-primary-50"
                      >
                        {f === "xlsx" ? "Excel (.xlsx)" : f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {canCreate && (
              <>
                <Button variant="outline" onClick={() => setShowImport(true)}>
                  <Upload size={16} /> Impor
                </Button>
                <Link to="/atlet/new">
                  <Button>
                    <Plus size={16} /> Tambah
                  </Button>
                </Link>
              </>
            )}
            </>
            )}
          </div>
        }
      />

      <Card className="mb-4 space-y-3">
        <SearchInput
          placeholder="Cari nama, NIK, atau nomor registrasi..."
          value={search}
          onChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          onSubmit={() => setDebouncedSearch(search)}
          suggestions={items?.map((a) => a.namaLengkap) ?? []}
        />
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
        !error && <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : (
        <>
          <DataTable columns={columns} rows={items} bulkActions={bulkActions} emptyMessage={showArchive ? "Arsip kosong." : "Belum ada data atlet."} />
          <div className="mt-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </>
      )}

      {showImport && (
        <AtletImportModal
          onImported={() => setReloadKey((k) => k + 1)}
          onClose={() => setShowImport(false)}
        />
      )}

      {statusTargetIds && (
        <Modal title="Ubah Status Atlet" onClose={() => setStatusTargetIds(null)}>
          <div className="space-y-4 text-sm">
            <p className="text-neutral-700">
              Ubah status untuk <span className="font-semibold">{statusTargetIds.length} atlet</span> terpilih.
            </p>
            <Select
              value={bulkStatus}
              onChange={(v) => setBulkStatus(v as AthleteStatus)}
              options={ATHLETE_STATUSES.map((s) => ({ value: s, label: ATHLETE_STATUS_LABELS[s] }))}
              className="w-full"
            />
            <div className="flex gap-2">
              <Button disabled={savingStatus} onClick={() => void submitBulkStatus()}>
                {savingStatus ? "Menyimpan..." : "Ubah Status"}
              </Button>
              <Button variant="outline" onClick={() => setStatusTargetIds(null)}>
                Batal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
