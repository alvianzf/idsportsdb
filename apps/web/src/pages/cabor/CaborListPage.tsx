import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Input } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface CaborRow {
  id: string;
  nama: string;
  ketuaCabor: string | null;
  sekretariat: string | null;
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
  }, [search]);

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
      ) : items.length === 0 ? (
        <Card className="text-sm text-neutral-500">Belum ada cabang olahraga.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((cabor) => (
            <Link key={cabor.id} to={`/cabor/${cabor.id}`}>
              <Card className="h-full transition-colors hover:border-primary-200">
                <h3 className="font-semibold text-neutral-900">{cabor.nama}</h3>
                {cabor.ketuaCabor && (
                  <p className="mt-1 text-sm text-neutral-500">Ketua: {cabor.ketuaCabor}</p>
                )}
                <div className="mt-3 flex gap-4 text-sm text-neutral-600">
                  <span>{cabor.jumlahAtlet} atlet</span>
                  <span>{cabor.jumlahPelatih} pelatih</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
