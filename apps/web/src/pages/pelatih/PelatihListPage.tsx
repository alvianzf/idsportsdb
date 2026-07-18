import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArchiveRestore, Plus, Search, Trash2 } from "lucide-react";
import { DATA_ADMIN_ROLES, LICENSE_TIERS, UNSCOPED_ADMIN_ROLES, UNSCOPED_VIEW_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Input, Badge, Pagination, Combobox, DataTable, Select, type Column, type BulkAction } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { confirmAction } from "../../lib/confirm";
import toast from "react-hot-toast";

interface PelatihRow {
  id: string;
  namaPelatih: string;
  nomorLisensi: string;
  tingkatanLisensi: string;
  masaBerlakuAkhir: string | null;
  cabangOlahraga: { id: string; nama: string };
}

interface CaborOption {
  id: string;
  nama: string;
}

/** Module C — Data Pelatih list. See specs/005-pelatih/spec.md. */
export function PelatihListPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canCreate = role && DATA_ADMIN_ROLES.includes(role);
  const canDelete = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const isUnscopedAdmin = role && UNSCOPED_VIEW_ROLES.includes(role);
  // #70 — soft-delete recovery. Admins can view the archive and restore;
  // only SUPER_ADMIN can permanently purge.
  const canRestore = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const canHardDelete = role === "SUPER_ADMIN_KONI";
  const [showArchive, setShowArchive] = useState(false);

  const [items, setItems] = useState<PelatihRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cabor, setCabor] = useState("");
  const [tingkat, setTingkat] = useState("");
  const [expiring, setExpiring] = useState(false);
  const [page, setPage] = useState(1);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const pageSize = 20;

  useEffect(() => {
    if (!isUnscopedAdmin) return;
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
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
      .get("/pelatih", {
        params: {
          search: debouncedSearch || undefined,
          cabor: cabor || undefined,
          tingkat: tingkat || undefined,
          expiring: expiring || undefined,
          deleted: showArchive || undefined,
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
  }, [debouncedSearch, cabor, tingkat, expiring, showArchive, page, reloadKey]);

  function isExpiringSoon(date: string | null) {
    if (!date) return false;
    const days = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 90;
  }

  async function handleBulkDelete(ids: string[]) {
    const confirmed = await confirmAction({
      text: `Hapus ${ids.length} pelatih? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/pelatih/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} pelatih berhasil dihapus.`);
    } else {
      toast.error(`${failed} dari ${ids.length} pelatih gagal dihapus.`);
    }
    setReloadKey((k) => k + 1);
  }

  // #70 — restore archived coaches.
  async function handleRestore(ids: string[]) {
    const results = await Promise.allSettled(ids.map((id) => api.post(`/pelatih/${id}/restore`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} pelatih berhasil dipulihkan.`);
    } else {
      toast.error(`${failed} dari ${ids.length} pelatih gagal dipulihkan.`);
    }
    setReloadKey((k) => k + 1);
  }

  // #70 — permanently purge archived coaches (SUPER_ADMIN only).
  async function handleHardDelete(ids: string[]) {
    const confirmed = await confirmAction({
      text: `Hapus permanen ${ids.length} pelatih? Data tidak dapat dipulihkan.`,
      danger: true,
      confirmText: "Hapus Permanen",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/pelatih/${id}/permanent`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} pelatih dihapus permanen.`);
    } else {
      toast.error(`${failed} dari ${ids.length} pelatih gagal dihapus.`);
    }
    setReloadKey((k) => k + 1);
  }

  const columns: Column<PelatihRow>[] = [
    {
      key: "namaPelatih",
      label: "Nama",
      mobile: true,
      sortable: true,
      getValue: (p) => p.namaPelatih,
      render: (p) =>
        showArchive ? (
          <span className="font-medium text-neutral-700">{p.namaPelatih}</span>
        ) : (
          <Link to={`/pelatih/${p.id}`} className="font-medium text-primary hover:underline">
            {p.namaPelatih}
          </Link>
        ),
    },
    {
      key: "cabor",
      label: "Cabor",
      mobile: true,
      sortable: true,
      getValue: (p) => p.cabangOlahraga.nama,
      render: (p) => <span className="text-neutral-600">{p.cabangOlahraga.nama}</span>,
    },
    {
      key: "nomorLisensi",
      label: "Nomor Lisensi",
      sortable: true,
      getValue: (p) => p.nomorLisensi,
      render: (p) => <span className="text-neutral-600">{p.nomorLisensi}</span>,
    },
    {
      key: "tingkatanLisensi",
      label: "Tingkatan",
      sortable: true,
      getValue: (p) => p.tingkatanLisensi,
      render: (p) => <span className="text-neutral-600">{p.tingkatanLisensi}</span>,
    },
    {
      key: "masaBerlakuAkhir",
      label: "Masa Berlaku",
      mobile: true,
      sortable: true,
      getValue: (p) => p.masaBerlakuAkhir ?? "",
      render: (p) =>
        p.masaBerlakuAkhir ? (
          <Badge tone={isExpiringSoon(p.masaBerlakuAkhir) ? "warning" : "neutral"}>
            {new Date(p.masaBerlakuAkhir).toLocaleDateString("id-ID")}
          </Badge>
        ) : (
          <span className="text-neutral-600">-</span>
        ),
    },
  ];

  const bulkActions: BulkAction[] = showArchive
    ? [
        ...(canRestore ? [{ label: "Pulihkan", icon: ArchiveRestore, variant: "outline" as const, onClick: handleRestore }] : []),
        ...(canHardDelete ? [{ label: "Hapus Permanen", icon: Trash2, variant: "danger" as const, onClick: handleHardDelete }] : []),
      ]
    : canDelete
      ? [{ label: "Hapus", icon: Trash2, variant: "danger", onClick: handleBulkDelete }]
      : [];

  return (
    <div>
      <PageHeader
        title="Data Pelatih"
        description="Daftar pelatih cabang olahraga"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canRestore && (
              <Button variant="outline" onClick={() => { setPage(1); setShowArchive((v) => !v); }}>
                {showArchive ? <><ArchiveRestore size={16} /> Data Aktif</> : <><Archive size={16} /> Arsip</>}
              </Button>
            )}
            {canCreate && !showArchive && (
              <Link to="/pelatih/new">
                <Button>
                  <Plus size={16} /> Tambah
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <Card className="mb-4">
        {/* Revisi 2026-07-18: search + filters share one row (like Pengguna). */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Cari nama pelatih atau nomor lisensi..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="pl-9"
            />
          </div>
          {isUnscopedAdmin && (
            <Combobox
              value={cabor}
              onChange={(v) => { setPage(1); setCabor(v); }}
              options={[{ value: "", label: "Semua Cabor" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
              placeholder="Semua Cabor"
              className="w-full md:w-64"
            />
          )}
          <Select
            value={tingkat}
            onChange={(v) => { setPage(1); setTingkat(v); }}
            options={[
              { value: "", label: "Semua Tingkatan" },
              ...LICENSE_TIERS.map((t) => ({ value: t, label: t })),
            ]}
            className="w-full md:w-48"
          />
          <label className="flex shrink-0 items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={expiring}
              onChange={(e) => {
                setPage(1);
                setExpiring(e.target.checked);
              }}
            />
            Lisensi akan habis (90 hari)
          </label>
        </div>
      </Card>

      {error && <Card className="text-sm text-danger">Gagal memuat data.</Card>}

      {items === null ? (
        !error && <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : (
        <>
          <DataTable columns={columns} rows={items} bulkActions={bulkActions} emptyMessage={showArchive ? "Arsip kosong." : "Belum ada data pelatih."} />
          <div className="mt-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
