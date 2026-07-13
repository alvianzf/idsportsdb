import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Input, DataTable, type Column, type BulkAction } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { confirmAction } from "../../lib/confirm";
import toast from "react-hot-toast";

interface CaborRow {
  id: string;
  nama: string;
  ketuaCabor: string | null;
  sekretariat: string | null;
  organisasiNasional: string | null;
  logoOrganisasiUrl: string | null;
  jumlahAtlet: number;
  jumlahPelatih: number;
}

/** Module E — Cabang Olahraga list. See specs/003-cabang-olahraga/spec.md. */
export function CaborListPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canCreate = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [items, setItems] = useState<CaborRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api
      .get<CaborRow[]>("/cabor", { params: search ? { search } : undefined })
      .then((res) => {
        if (!cancelled) setItems(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [search, reloadKey]);

  async function handleBulkDelete(ids: string[]) {
    const confirmed = await confirmAction({
      text: `Hapus ${ids.length} cabang olahraga? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/cabor/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} cabang olahraga berhasil dihapus.`);
    } else {
      toast.error(`${failed} dari ${ids.length} cabang olahraga gagal dihapus.`);
    }
    setReloadKey((k) => k + 1);
  }

  const columns: Column<CaborRow>[] = [
    {
      key: "nama",
      label: "Cabang Olahraga",
      sortable: true,
      mobile: true,
      getValue: (c) => c.nama,
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.logoOrganisasiUrl ? (
            <img
              src={resolveFileUrl(c.logoOrganisasiUrl)}
              alt={c.organisasiNasional ?? c.nama}
              className="h-8 w-8 shrink-0 rounded object-contain"
            />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded bg-neutral-100" />
          )}
          <div>
            <Link to={`/cabor/${c.id}`} className="font-medium text-primary hover:underline">
              {c.nama}
            </Link>
            {c.organisasiNasional && (
              <p className="text-xs text-neutral-400">{c.organisasiNasional}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "ketuaCabor",
      label: "Ketua",
      getValue: (c) => c.ketuaCabor ?? "",
      render: (c) => <span className="text-neutral-600">{c.ketuaCabor ?? "-"}</span>,
    },
    {
      key: "sekretariat",
      label: "Sekretariat",
      getValue: (c) => c.sekretariat ?? "",
      render: (c) => <span className="text-neutral-600">{c.sekretariat ?? "-"}</span>,
    },
    {
      key: "jumlahAtlet",
      label: "Atlet",
      sortable: true,
      mobile: true,
      getValue: (c) => c.jumlahAtlet,
      render: (c) => <span className="text-neutral-600">{c.jumlahAtlet} atlet</span>,
    },
    {
      key: "jumlahPelatih",
      label: "Pelatih",
      mobile: true,
      sortable: true,
      getValue: (c) => c.jumlahPelatih,
      render: (c) => <span className="text-neutral-600">{c.jumlahPelatih} pelatih</span>,
    },
  ];

  const bulkActions: BulkAction[] = canCreate
    ? [{ label: "Hapus", icon: Trash2, variant: "danger", onClick: handleBulkDelete }]
    : [];

  return (
    <div>
      <PageHeader
        title="Cabang Olahraga"
        description="Daftar cabang olahraga binaan KONI Batam"
        actions={
          canCreate ? (
            <Link to="/cabor/new">
              <Button>
                <Plus size={16} /> Tambah
              </Button>
            </Link>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Cari nama cabang olahraga..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {error && <Card className="text-sm text-danger">Gagal memuat data.</Card>}

      {items === null ? (
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : (
        <DataTable columns={columns} rows={items} bulkActions={bulkActions} emptyMessage="Belum ada cabang olahraga." />
      )}
    </div>
  );
}
