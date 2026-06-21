import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Modal, Combobox } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";
import { PengurusViews, type Pengurus } from "./PengurusOrgViews";

interface CaborDetail {
  id: string;
  nama: string;
  ketuaCabor: string | null;
  sekretariat: string | null;
  organisasiNasional: string | null;
  logoOrganisasiUrl: string | null;
  jumlahAtlet: number;
  jumlahPelatih: number;
  pengurus: Pengurus[];
}

interface PengurusForm {
  namaPengurus: string;
  jabatan: string;
  masaBaktiMulai: string;
  masaBaktiAkhir: string;
  kontak: string;
  reportsToId: string;
}

const emptyPengurus: PengurusForm = {
  namaPengurus: "",
  jabatan: "",
  masaBaktiMulai: "",
  masaBaktiAkhir: "",
  kontak: "",
  reportsToId: "",
};

/** Module E — Cabang Olahraga detail + pengurus management. See specs/003-cabang-olahraga/spec.md, specs/006-pengurus-cabor/spec.md. */
export function CaborDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const canDelete = role === "SUPER_ADMIN_KONI";

  const [cabor, setCabor] = useState<CaborDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPengurus, setEditingPengurus] = useState<Pengurus | null>(null);
  const [form, setForm] = useState<PengurusForm>(emptyPengurus);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!id) return;
    api
      .get<CaborDetail>(`/cabor/${id}`)
      .then((res) => setCabor(res.data))
      .catch(() => setError("Gagal memuat data cabang olahraga."));
  }

  useEffect(load, [id]);

  function openCreate() {
    setEditingPengurus(null);
    setForm(emptyPengurus);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(p: Pengurus) {
    setEditingPengurus(p);
    setForm({
      namaPengurus: p.namaPengurus,
      jabatan: p.jabatan,
      masaBaktiMulai: p.masaBaktiMulai.slice(0, 10),
      masaBaktiAkhir: p.masaBaktiAkhir.slice(0, 10),
      kontak: p.kontak ?? "",
      reportsToId: p.reportsToId ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSavePengurus(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        namaPengurus: form.namaPengurus,
        jabatan: form.jabatan,
        masaBaktiMulai: form.masaBaktiMulai,
        masaBaktiAkhir: form.masaBaktiAkhir,
        kontak: form.kontak || undefined,
        reportsToId: form.reportsToId || null,
      };
      if (editingPengurus) {
        await api.patch(`/pengurus/${editingPengurus.id}`, payload);
        toast.success("Pengurus berhasil diubah.");
      } else {
        await api.post(`/cabor/${id}/pengurus`, payload);
        toast.success("Pengurus berhasil ditambahkan.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: unknown } } }).response?.data;
      const flat = data?.error;
      let text = "Gagal menyimpan data pengurus.";
      if (typeof flat === "string") text = flat;
      else if (flat && typeof flat === "object" && "fieldErrors" in (flat as object)) {
        const fieldErrors = (flat as { fieldErrors: Record<string, string[]> }).fieldErrors;
        const first = Object.values(fieldErrors).flat()[0];
        if (first) text = first;
      }
      setFormError(text);
    } finally {
      setSaving(false);
    }
  }

  async function handleReassignPengurus(pengurusId: string, reportsToId: string | null) {
    try {
      await api.patch(`/pengurus/${pengurusId}`, { reportsToId });
      toast.success("Struktur organisasi berhasil diubah.");
      load();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Gagal mengubah struktur organisasi.");
    }
  }

  async function handleSwapPengurus(idA: string, idB: string) {
    if (!cabor) return;
    const a = cabor.pengurus.find((p) => p.id === idA);
    const b = cabor.pengurus.find((p) => p.id === idB);
    if (!a || !b) return;

    // Guard: prevent swap between a node and its ancestor/descendant (would create cycle)
    function isAncestor(ancestorId: string, nodeId: string): boolean {
      const node = cabor!.pengurus.find((p) => p.id === nodeId);
      if (!node?.reportsToId) return false;
      if (node.reportsToId === ancestorId) return true;
      return isAncestor(ancestorId, node.reportsToId);
    }

    if (isAncestor(idA, idB) || isAncestor(idB, idA)) {
      toast.error("Tidak dapat menukar pengurus yang memiliki hubungan hierarki langsung.");
      return;
    }

    try {
      // Exchange the two reportsToId values simultaneously
      await Promise.all([
        api.patch(`/pengurus/${idA}`, { reportsToId: b.reportsToId }),
        api.patch(`/pengurus/${idB}`, { reportsToId: a.reportsToId }),
      ]);
      toast.success("Posisi berhasil ditukar.");
      load();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Gagal menukar posisi.");
    }
  }

  async function handleDeletePengurus(p: Pengurus) {
    if (!(await confirmAction({ text: `Hapus pengurus "${p.namaPengurus}"?` }))) return;
    try {
      await api.delete(`/pengurus/${p.id}`);
      toast.success("Pengurus berhasil dihapus.");
      load();
    } catch {
      toast.error("Gagal menghapus pengurus.");
    }
  }

  async function handleDeleteCabor() {
    if (!cabor) return;
    if (!(await confirmAction({ text: `Hapus cabang olahraga "${cabor.nama}"?` }))) return;
    try {
      await api.delete(`/cabor/${cabor.id}`);
      toast.success("Cabang olahraga berhasil dihapus.");
      navigate("/cabor");
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Gagal menghapus cabang olahraga.");
    }
  }

  if (error) return <Card className="text-sm text-danger">{error}</Card>;
  if (!cabor) return <Card className="text-sm text-neutral-500">Memuat data...</Card>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft size={15} /> Kembali
      </button>
      <PageHeader
        title={cabor.nama}
        description="Detail cabang olahraga"
        actions={
          isUnscopedAdmin ? (
            <div className="flex gap-2">
              <Link to={`/cabor/${cabor.id}/edit`}>
                <Button variant="outline">
                  <Pencil size={16} /> Ubah
                </Button>
              </Link>
              {canDelete && (
                <Button variant="outline" onClick={handleDeleteCabor}>
                  <Trash2 size={16} /> Hapus
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="flex items-start gap-4">
          {/* Org logo */}
          {cabor.logoOrganisasiUrl && (
            <img
              src={resolveFileUrl(cabor.logoOrganisasiUrl)}
              alt={cabor.organisasiNasional ?? "Logo"}
              className="h-20 w-20 shrink-0 rounded-lg border border-neutral-200 object-contain p-1"
            />
          )}
          <dl className="grid flex-1 gap-3 text-sm md:grid-cols-2">
            {cabor.organisasiNasional && (
              <div className="md:col-span-2">
                <dt className="text-neutral-500">Organisasi Nasional</dt>
                <dd className="font-semibold text-neutral-900">{cabor.organisasiNasional}</dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">Ketua Cabor</dt>
              <dd className="font-medium text-neutral-900">{cabor.ketuaCabor ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Sekretariat</dt>
              <dd className="font-medium text-neutral-900">{cabor.sekretariat ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Jumlah Atlet</dt>
              <dd className="font-medium text-neutral-900">{cabor.jumlahAtlet}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Jumlah Pelatih</dt>
              <dd className="font-medium text-neutral-900">{cabor.jumlahPelatih}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Pengurus Cabor</h2>
          {isUnscopedAdmin && (
            <Button variant="outline" onClick={openCreate}>
              <Plus size={16} /> Tambah
            </Button>
          )}
        </div>

        {cabor.pengurus.length === 0 ? (
          <p className="text-sm text-neutral-500">Belum ada data pengurus.</p>
        ) : (
          <PengurusViews
            pengurus={cabor.pengurus}
            canManage={!!isUnscopedAdmin}
            onEdit={openEdit}
            onDelete={handleDeletePengurus}
            onReassign={handleReassignPengurus}
            onSwap={handleSwapPengurus}
          />
        )}
      </Card>

      {modalOpen && (
        <Modal title={editingPengurus ? "Ubah Pengurus" : "Tambah Pengurus"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSavePengurus} className="space-y-4">
            <Field label="Nama Pengurus" required htmlFor="namaPengurus">
              <Input
                id="namaPengurus"
                required
                value={form.namaPengurus}
                onChange={(e) => setForm((f) => ({ ...f, namaPengurus: e.target.value }))}
              />
            </Field>
            <Field label="Jabatan" required htmlFor="jabatan">
              <Input
                id="jabatan"
                required
                value={form.jabatan}
                onChange={(e) => setForm((f) => ({ ...f, jabatan: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Masa Bakti Mulai" required htmlFor="masaBaktiMulai">
                <Input
                  id="masaBaktiMulai"
                  type="date"
                  required
                  value={form.masaBaktiMulai}
                  onChange={(e) => setForm((f) => ({ ...f, masaBaktiMulai: e.target.value }))}
                />
              </Field>
              <Field label="Masa Bakti Akhir" required htmlFor="masaBaktiAkhir">
                <Input
                  id="masaBaktiAkhir"
                  type="date"
                  required
                  value={form.masaBaktiAkhir}
                  onChange={(e) => setForm((f) => ({ ...f, masaBaktiAkhir: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Kontak" htmlFor="kontak">
              <Input
                id="kontak"
                value={form.kontak}
                onChange={(e) => setForm((f) => ({ ...f, kontak: e.target.value }))}
              />
            </Field>
            <Field label="Melapor Kepada" htmlFor="reportsToId">
              <Combobox
                id="reportsToId"
                value={form.reportsToId}
                onChange={(v) => setForm((f) => ({ ...f, reportsToId: v }))}
                options={[
                  { value: "", label: "Tidak ada (paling atas)" },
                  ...cabor.pengurus
                    .filter((p) => p.id !== editingPengurus?.id)
                    .map((p) => ({ value: p.id, label: `${p.namaPengurus} — ${p.jabatan}` })),
                ]}
                placeholder="Tidak ada (paling atas)"
              />
            </Field>

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
