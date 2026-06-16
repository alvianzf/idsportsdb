import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { DATA_ADMIN_ROLES, UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Badge } from "../../components/ui";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";

interface PelatihDetail {
  id: string;
  namaPelatih: string;
  nomorLisensi: string;
  tingkatanLisensi: string;
  masaBerlakuMulai: string | null;
  masaBerlakuAkhir: string | null;
  riwayatKepelatihan: string | null;
  cabangOlahraga: { id: string; nama: string };
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

/** Module C — Pelatih detail. See specs/005-pelatih/spec.md. */
export function PelatihDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = role && DATA_ADMIN_ROLES.includes(role);
  const canDelete = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [pelatih, setPelatih] = useState<PelatihDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<PelatihDetail>(`/pelatih/${id}`)
      .then((res) => setPelatih(res.data))
      .catch(() => setError("Gagal memuat data pelatih."));
  }, [id]);

  async function handleDelete() {
    if (!pelatih) return;
    if (!(await confirmAction({ text: `Hapus pelatih "${pelatih.namaPelatih}"?` }))) return;
    try {
      await api.delete(`/pelatih/${pelatih.id}`);
      toast.success("Pelatih berhasil dihapus.");
      navigate("/pelatih");
    } catch {
      toast.error("Gagal menghapus pelatih.");
    }
  }

  if (error) return <Card className="text-sm text-danger">{error}</Card>;
  if (!pelatih) return <Card className="text-sm text-neutral-500">Memuat data...</Card>;

  const isExpiringSoon =
    pelatih.masaBerlakuAkhir &&
    (new Date(pelatih.masaBerlakuAkhir).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 90;

  return (
    <div>
      <PageHeader
        title={pelatih.namaPelatih}
        description={pelatih.cabangOlahraga.nama}
        actions={
          <div className="flex gap-2">
            {canEdit && (
              <Link to={`/pelatih/${pelatih.id}/edit`}>
                <Button variant="outline">
                  <Pencil size={16} /> Ubah
                </Button>
              </Link>
            )}
            {canDelete && (
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 size={16} /> Hapus
              </Button>
            )}
          </div>
        }
      />

      <Card className="space-y-4">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Nomor Lisensi</dt>
            <dd className="font-medium text-neutral-900">{pelatih.nomorLisensi}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Tingkatan Lisensi</dt>
            <dd className="font-medium text-neutral-900">{pelatih.tingkatanLisensi}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Masa Berlaku Mulai</dt>
            <dd className="font-medium text-neutral-900">{formatDate(pelatih.masaBerlakuMulai)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Masa Berlaku Akhir</dt>
            <dd className="font-medium text-neutral-900">
              {formatDate(pelatih.masaBerlakuAkhir)}
              {isExpiringSoon && (
                <Badge tone="warning" className="ml-2">
                  Akan habis
                </Badge>
              )}
            </dd>
          </div>
        </dl>

        {pelatih.riwayatKepelatihan && (
          <div>
            <h2 className="mb-1 text-sm font-semibold text-neutral-900">Riwayat Kepelatihan</h2>
            <p className="whitespace-pre-wrap text-sm text-neutral-600">{pelatih.riwayatKepelatihan}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
