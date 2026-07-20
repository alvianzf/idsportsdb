import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, ScanLine, Trash2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { DATA_ADMIN_ROLES, UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { PageHeader, Button } from "../../components/ui";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";
import type { AtletDetail } from "./types";
import { BiodataTab } from "./tabs/BiodataTab";
import { DokumenTab } from "./tabs/DokumenTab";
import { PrestasiTab } from "./tabs/PrestasiTab";
import { MonitoringTab } from "./tabs/MonitoringTab";

const TABS = [
  { key: "biodata", label: "Biodata" },
  { key: "dokumen", label: "Dokumen" },
  { key: "prestasi", label: "Prestasi" },
  { key: "monitoring", label: "Monitoring" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Module B — Atlet detail. See specs/004-atlet/spec.md. */
export function AtletDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = role && DATA_ADMIN_ROLES.includes(role);
  const canDelete = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [atlet, setAtlet] = useState<AtletDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("biodata");

  function load() {
    if (!id) return;
    api
      .get<AtletDetail>(`/atlet/${id}`)
      .then((res) => setAtlet(res.data))
      .catch(() => setError("Gagal memuat data atlet."));
  }

  useEffect(load, [id]);

  async function handleDelete() {
    if (!atlet) return;
    if (!(await confirmAction({ text: `Hapus atlet "${atlet.namaLengkap}"?` }))) return;
    try {
      await api.delete(`/atlet/${atlet.id}`);
      toast.success("Atlet berhasil dihapus.");
      navigate("/atlet");
    } catch {
      toast.error("Gagal menghapus atlet.");
    }
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!atlet) return <p className="text-sm text-neutral-500">Memuat data...</p>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft size={15} /> Kembali
      </button>
      <PageHeader
        title={atlet.namaLengkap}
        description={[atlet.nomorIndukAtlet, atlet.cabangOlahraga.nama].filter(Boolean).join(" · ")}
        actions={
          <div className="flex gap-2">
            <Link to={`/atlet/${atlet.id}/rekam`}>
              <Button variant="outline">
                <ScanLine size={16} /> Rekam Atlet
              </Button>
            </Link>
            {canEdit && !atlet.user && (
              <Link to={`/users/new?athleteId=${atlet.id}`}>
                <Button variant="outline">
                  <UserPlus size={16} /> Buatkan Akun
                </Button>
              </Link>
            )}
            {canEdit && (
              <Link to={`/atlet/${atlet.id}/edit`}>
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

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "biodata" && <BiodataTab atlet={atlet} />}
      {tab === "dokumen" && (
        <DokumenTab atletId={atlet.id} documents={atlet.documents ?? []} canManage={!!canEdit} onChange={load} />
      )}
      {tab === "prestasi" && <PrestasiTab atletId={atlet.id} canManage={!!canEdit} />}
      {tab === "monitoring" && (
        <MonitoringTab atletId={atlet.id} canManage={!!canEdit} currentCabangOlahragaId={atlet.cabangOlahragaId} />
      )}
    </div>
  );
}
