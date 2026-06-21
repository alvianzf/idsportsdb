import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Modal, Combobox, DropZone } from "../../components/ui";
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

      {/* SK & Dokumen Resmi */}
      <CaborDokumenSection caborId={cabor.id} canManage={!!isUnscopedAdmin} />

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

// ---------------------------------------------------------------------------
// SK & Official Document Section
// ---------------------------------------------------------------------------

interface CaborDoc {
  id: string;
  jenis: string;
  nomorDokumen: string | null;
  tanggalDokumen: string | null;
  deskripsi: string | null;
  fileUrl: string;
  uploadedAt: string;
}

function CaborDokumenSection({ caborId, canManage }: { caborId: string; canManage: boolean }) {
  const [docs, setDocs] = useState<CaborDoc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [jenis, setJenis] = useState("SK Pengurus");
  const [nomorDokumen, setNomorDokumen] = useState("");
  const [tanggalDokumen, setTanggalDokumen] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function loadDocs() {
    api.get<CaborDoc[]>(`/cabor/${caborId}/documents`).then((r) => setDocs(r.data)).catch(() => undefined);
  }

  useEffect(() => { loadDocs(); }, [caborId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Pilih file terlebih dahulu."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("jenis", jenis);
      if (nomorDokumen) fd.append("nomorDokumen", nomorDokumen);
      if (tanggalDokumen) fd.append("tanggalDokumen", tanggalDokumen);
      if (deskripsi) fd.append("deskripsi", deskripsi);
      await api.post(`/cabor/${caborId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Dokumen berhasil diunggah.");
      setShowForm(false);
      setFile(null);
      setJenis("SK Pengurus");
      setNomorDokumen("");
      setTanggalDokumen("");
      setDeskripsi("");
      loadDocs();
    } catch {
      toast.error("Gagal mengunggah dokumen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(doc: CaborDoc) {
    if (!(await confirmAction({ text: `Hapus dokumen "${doc.jenis}"? File akan dihapus permanen.`, danger: true, confirmText: "Hapus" }))) return;
    try {
      await api.delete(`/cabor/${caborId}/documents/${doc.id}`);
      toast.success("Dokumen berhasil dihapus.");
      loadDocs();
    } catch {
      toast.error("Gagal menghapus dokumen.");
    }
  }

  return (
    <Card className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">SK & Dokumen Resmi</h2>
        {canManage && (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Unggah Dokumen
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-neutral-500">Belum ada dokumen.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="shrink-0 text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-900">{doc.jenis}</span>
                  {doc.nomorDokumen && (
                    <span className="text-xs text-neutral-500">No. {doc.nomorDokumen}</span>
                  )}
                </div>
                {doc.deskripsi && <p className="mt-0.5 text-xs text-neutral-500">{doc.deskripsi}</p>}
                <div className="mt-1 flex gap-3 text-xs text-neutral-400">
                  {doc.tanggalDokumen && (
                    <span>{new Date(doc.tanggalDokumen).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</span>
                  )}
                  <span>Diunggah {new Date(doc.uploadedAt).toLocaleDateString("id-ID")}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={resolveFileUrl(doc.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Lihat
                </a>
                {canManage && (
                  <button onClick={() => handleDelete(doc)} className="text-neutral-400 hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <Modal title="Unggah Dokumen" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Jenis Dokumen" required htmlFor="jenis">
              <Input
                id="jenis"
                list="jenis-list"
                required
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                placeholder="SK Pengurus, SK Pembentukan, Sertifikat Afiliasi…"
              />
              <datalist id="jenis-list">
                <option value="SK Pengurus" />
                <option value="SK Pembentukan" />
                <option value="SK Afiliasi" />
                <option value="Sertifikat Afiliasi" />
                <option value="Peraturan Organisasi" />
                <option value="Anggaran Dasar" />
                <option value="Anggaran Rumah Tangga" />
              </datalist>
            </Field>
            <Field label="Nomor Dokumen" htmlFor="nomorDokumen">
              <Input id="nomorDokumen" value={nomorDokumen} onChange={(e) => setNomorDokumen(e.target.value)} placeholder="Mis: 001/SK/KONI/2024" />
            </Field>
            <Field label="Tanggal Dokumen" htmlFor="tanggalDokumen">
              <Input id="tanggalDokumen" type="date" value={tanggalDokumen} onChange={(e) => setTanggalDokumen(e.target.value)} />
            </Field>
            <Field label="Deskripsi" htmlFor="deskripsi">
              <Input id="deskripsi" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
            </Field>
            <Field label="File" required>
              <DropZone
                value={file}
                onChange={setFile}
                sublabel="PDF, DOC, JPG — maks. 20 MB"
              />
            </Field>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
