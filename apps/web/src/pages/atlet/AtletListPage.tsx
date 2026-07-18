import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Download, Plus, Search, Tag, Trash2, Upload } from "lucide-react";
import {
  ATHLETE_STATUSES,
  ATHLETE_STATUS_LABELS,
  BATAM_KECAMATAN,
  DATA_ADMIN_ROLES,
  UNSCOPED_ADMIN_ROLES,
  UNSCOPED_VIEW_ROLES,
  type AthleteStatus,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Input, Select, Badge, Pagination, Combobox, DataTable, DropZone, Modal, type Column, type BulkAction } from "../../components/ui";
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
  RETIRED: "neutral",
};

/** Module B — Data Atlet list. See specs/004-atlet/spec.md. */
export function AtletListPage() {
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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: { row: number; namaLengkap: string; nik: string; cabor: string; jenisKelamin: string; statusAtlet: string; error?: string }[];
    valid: number;
    invalid: number;
    summary?: { issue: string; count: number; examples: string[] }[];
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; rejected: { row: number; error: string }[] } | null>(null);
  // #73 — bulk status change. Selected ids are captured when the action fires,
  // since the DataTable clears its selection right after onClick.
  const [statusTargetIds, setStatusTargetIds] = useState<string[] | null>(null);
  const [bulkStatus, setBulkStatus] = useState<AthleteStatus>("ACTIVE");
  const [savingStatus, setSavingStatus] = useState(false);

  const pageSize = 20;

  // #73 — the dashboard "Impor Atlet" quick action deep-links here with ?import=1.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (canCreate && searchParams.get("import") === "1") {
      setShowImport(true);
      searchParams.delete("import");
      setSearchParams(searchParams, { replace: true });
    }
  }, [canCreate, searchParams, setSearchParams]);

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

  // Sample files so users don't upload the wrong format.
  async function handleTemplateDownload(format: "xlsx" | "csv") {
    try {
      const res = await api.get("/atlet/import/template", { params: { format }, responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `template-impor-atlet.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh template.");
    }
  }

  // Parse+validate on the server without writing, to preview before upload.
  async function handleImportFileChange(file: File | null) {
    setImportFile(file);
    setImportPreview(null);
    if (!file) return;
    setPreviewing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<typeof importPreview>("/atlet/import?dryRun=1", form);
      setImportPreview(res.data);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(typeof message === "string" ? message : "Gagal membaca berkas.");
      setImportFile(null);
    } finally {
      setPreviewing(false);
    }
  }

  function closeImport() {
    setShowImport(false);
    setImportFile(null);
    setImportPreview(null);
  }

  // Revisi 2026-07-12: bulk update — import athletes from an uploaded Excel/CSV.
  async function handleImportSubmit() {
    if (!importFile) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await api.post<{ imported: number; rejected: { row: number; error: string }[] }>(
        "/atlet/import",
        form,
      );
      closeImport();
      setImportResult(res.data);
      if (res.data.imported > 0) setReloadKey((k) => k + 1);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(typeof message === "string" ? message : "Gagal mengimpor berkas.");
    } finally {
      setImporting(false);
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
                        className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
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
        <Modal title="Impor Data Atlet" onClose={closeImport}>
          <div className="space-y-4 text-sm">
            <div className="space-y-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
              <p className="font-semibold text-neutral-800">Ketentuan berkas</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Format <strong>Excel (.xlsx)</strong> atau <strong>CSV</strong>, maksimal 10 MB.</li>
                <li>Baris pertama harus berupa judul kolom. Kolom yang dikenali:
                  Nomor Induk, Nomor Registrasi, Nama Lengkap, NIK, Jenis Kelamin,
                  Cabang Olahraga, Status, Alamat, Kecamatan, Nomor HP, Email,
                  Pendidikan Terakhir, Pekerjaan.</li>
                <li>Wajib diisi: Nomor Induk, Nomor Registrasi, Nama Lengkap, NIK (16 digit), Jenis Kelamin, Alamat.</li>
                <li>Jenis Kelamin: <strong>L</strong> atau <strong>P</strong>; Status: <strong>Aktif</strong> / <strong>Tidak Aktif</strong> (kosong = Aktif).</li>
                {isUnscopedAdmin ? (
                  <li>Kolom Cabang Olahraga diisi <strong>nama cabor</strong> persis seperti terdaftar.</li>
                ) : (
                  <li>Seluruh baris diimpor ke cabor Anda — kolom Cabang Olahraga diabaikan.</li>
                )}
                <li>Semua baris harus valid. Jika ada baris bermasalah (mis. nama cabor salah), seluruh impor ditolak — perbaiki dahulu lalu unggah ulang.</li>
              </ul>
              <div className="space-y-2 pt-2">
                <p>Gunakan template agar format tidak salah:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="px-4 py-1.5" onClick={() => void handleTemplateDownload("xlsx")}>
                    <Download size={16} /> Excel
                  </Button>
                  <Button variant="outline" className="px-4 py-1.5" onClick={() => void handleTemplateDownload("csv")}>
                    <Download size={16} /> CSV
                  </Button>
                </div>
              </div>
            </div>

            <DropZone
              accept=".xlsx,.csv"
              value={importFile}
              onChange={(f) => void handleImportFileChange(f)}
              label="Seret & lepas berkas Excel/CSV di sini"
              sublabel=".xlsx atau .csv, maks. 10 MB"
            />

            {previewing && <p className="text-xs text-neutral-500">Membaca berkas...</p>}

            {importPreview && (
              <div>
                <p className="mb-2 text-xs text-neutral-600">
                  Pratinjau: <span className="font-semibold text-success">{importPreview.valid} baris valid</span>
                  {importPreview.invalid > 0 && (
                    <>
                      , <span className="font-semibold text-danger">{importPreview.invalid} bermasalah</span> — perbaiki dahulu, impor akan ditolak
                    </>
                  )}
                </p>
                {importPreview.summary && importPreview.summary.length > 0 && (
                  <div className="mb-2 space-y-2 rounded-lg border border-danger/30 bg-danger-light/30 p-3 text-xs">
                    <p className="font-semibold text-danger">Yang perlu diperbaiki:</p>
                    <ul className="space-y-2">
                      {importPreview.summary.map((s) => (
                        <li key={s.issue}>
                          <span className="font-medium text-neutral-800">{s.issue}</span>{" "}
                          <span className="text-danger">({s.count} baris)</span>
                          <ul className="mt-0.5 list-disc pl-5 text-neutral-600">
                            {s.examples.map((ex, i) => (
                              <li key={i}>{ex}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="max-h-56 overflow-auto rounded-lg border border-neutral-200">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="sticky top-0 bg-neutral-50">
                      <tr className="text-left text-neutral-500">
                        <th className="px-2.5 py-2">Baris</th>
                        <th className="px-2.5 py-2">Nama</th>
                        <th className="px-2.5 py-2">NIK</th>
                        <th className="px-2.5 py-2">Cabor</th>
                        <th className="px-2.5 py-2">JK</th>
                        <th className="px-2.5 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {importPreview.rows.map((r) => (
                        <tr key={r.row} className={r.error ? "bg-danger-light/40" : undefined}>
                          <td className="px-2.5 py-1.5 text-neutral-500">{r.row}</td>
                          <td className="px-2.5 py-1.5 font-medium text-neutral-800">
                            {r.namaLengkap || "-"}
                            {r.error && <p className="font-normal text-danger">{r.error}</p>}
                          </td>
                          <td className="px-2.5 py-1.5 text-neutral-600">{r.nik || "-"}</td>
                          <td className="px-2.5 py-1.5 text-neutral-600">{r.cabor || "-"}</td>
                          <td className="px-2.5 py-1.5 text-neutral-600">{r.jenisKelamin || "-"}</td>
                          <td className="px-2.5 py-1.5 text-neutral-600">{r.statusAtlet || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                disabled={
                  !importFile ||
                  importing ||
                  previewing ||
                  !importPreview ||
                  importPreview.invalid > 0 ||
                  importPreview.valid === 0
                }
                onClick={() => void handleImportSubmit()}
              >
                <Upload size={16} />
                {importing
                  ? "Mengimpor..."
                  : importPreview
                    ? importPreview.invalid > 0
                      ? "Perbaiki baris bermasalah"
                      : `Impor ${importPreview.valid} Baris`
                    : "Impor"}
              </Button>
              <Button variant="outline" onClick={closeImport}>
                Batal
              </Button>
            </div>
          </div>
        </Modal>
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
