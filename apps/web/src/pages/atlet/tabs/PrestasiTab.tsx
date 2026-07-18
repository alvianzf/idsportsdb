import { useEffect, useState, type FormEvent } from "react";
import { FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import {
  COMPETITION_LEVEL_CHOICES,
  COMPETITION_LEVEL_LABELS,
  MEDALS,
  MEDAL_LABELS,
  type CompetitionLevel,
  type Medal,
} from "@inasportdb/shared-types";
import { Card, Button, Badge, DropZone, Field, Input, Select, Modal } from "../../../components/ui";
import { api, resolveFileUrl } from "../../../lib/api";
import { confirmAction } from "../../../lib/confirm";

interface PrestasiSertifikat {
  id: string;
  fileUrl: string;
  uploadedAt: string;
}

interface Prestasi {
  id: string;
  namaKejuaraan: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: number;
  medali: Medal;
  peringkat: number | null;
  // Legacy single certificate; new uploads land in `sertifikats`.
  sertifikatUrl: string | null;
  sertifikats: PrestasiSertifikat[];
}

interface PrestasiForm {
  namaKejuaraan: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: string;
  medali: Medal;
  peringkat: string;
}

const emptyForm: PrestasiForm = {
  namaKejuaraan: "",
  tingkatKejuaraan: "KEJURDA",
  tahun: String(new Date().getFullYear()),
  medali: "GOLD",
  peringkat: "",
};

const MEDAL_TONE: Record<Medal, "gold" | "silver" | "bronze" | "neutral"> = {
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
  NONE: "neutral",
};

function extractError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "fieldErrors" in (data as object)) {
    const fieldErrors = (data as { fieldErrors: Record<string, string[]> }).fieldErrors;
    const first = Object.values(fieldErrors).flat()[0];
    if (first) return first;
  }
  return "Gagal menyimpan data.";
}

interface PrestasiTabProps {
  atletId: string;
  canManage: boolean;
}

export function PrestasiTab({ atletId, canManage }: PrestasiTabProps) {
  const [items, setItems] = useState<Prestasi[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Prestasi | null>(null);
  const [form, setForm] = useState<PrestasiForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Prestasi | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  function load() {
    api
      .get<Prestasi[]>(`/atlet/${atletId}/prestasi`)
      .then((res) => setItems(res.data))
      .catch(() => setError("Gagal memuat data prestasi."));
  }

  useEffect(load, [atletId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(p: Prestasi) {
    setEditing(p);
    setForm({
      namaKejuaraan: p.namaKejuaraan,
      tingkatKejuaraan: p.tingkatKejuaraan,
      tahun: String(p.tahun),
      medali: p.medali,
      peringkat: p.peringkat != null ? String(p.peringkat) : "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        namaKejuaraan: form.namaKejuaraan,
        tingkatKejuaraan: form.tingkatKejuaraan,
        tahun: Number(form.tahun),
        medali: form.medali,
        peringkat: form.peringkat ? Number(form.peringkat) : undefined,
      };
      if (editing) {
        await api.patch(`/prestasi/${editing.id}`, payload);
        toast.success("Prestasi berhasil diubah.");
      } else {
        await api.post(`/atlet/${atletId}/prestasi`, payload);
        toast.success("Prestasi berhasil ditambahkan.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Prestasi) {
    if (!(await confirmAction({ text: `Hapus prestasi "${p.namaKejuaraan}"?` }))) return;
    try {
      await api.delete(`/prestasi/${p.id}`);
      toast.success("Prestasi berhasil dihapus.");
      load();
    } catch {
      toast.error("Gagal menghapus prestasi.");
    }
  }

  async function handleDeleteCert(p: Prestasi, s: PrestasiSertifikat) {
    if (!(await confirmAction({ text: "Hapus sertifikat ini?" }))) return;
    try {
      await api.delete(`/prestasi/${p.id}/sertifikat/${s.id}`);
      toast.success("Sertifikat berhasil dihapus.");
      load();
    } catch {
      toast.error("Gagal menghapus sertifikat.");
    }
  }

  // Revisi 2026-07-18: upload goes through a modal with a drag & drop zone + preview.
  async function handleUploadCert() {
    if (!uploadTarget || !uploadFile) return;
    const p = uploadTarget;
    setUploadTarget(null);
    setUploadFile(null);
    setUploadingId(p.id);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      await api.post(`/prestasi/${p.id}/sertifikat`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Sertifikat berhasil diunggah.");
      load();
    } catch {
      toast.error("Gagal mengunggah sertifikat.");
    } finally {
      setUploadingId(null);
    }
  }

  if (error) return <Card className="text-sm text-danger">{error}</Card>;
  if (items === null) return <Card className="text-sm text-neutral-500">Memuat data...</Card>;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Prestasi</h2>
        {canManage && (
          <Button variant="outline" onClick={openCreate}>
            <Plus size={16} /> Tambah
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Belum ada data prestasi.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium text-neutral-900">{p.namaKejuaraan}</p>
                <p className="text-neutral-500">
                  {COMPETITION_LEVEL_LABELS[p.tingkatKejuaraan]} &middot; {p.tahun}
                  {p.peringkat ? ` · Peringkat ${p.peringkat}` : ""}
                </p>
                {(p.sertifikatUrl || p.sertifikats.length > 0) && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {p.sertifikatUrl && (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <a
                          href={resolveFileUrl(p.sertifikatUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText size={14} /> Sertifikat
                        </a>
                        {canManage && (
                          <button
                            onClick={() => handleDeleteCert(p, { id: "legacy", fileUrl: p.sertifikatUrl!, uploadedAt: "" })}
                            aria-label="Hapus sertifikat"
                            className="text-neutral-400 hover:text-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    )}
                    {p.sertifikats.map((s, i) => (
                      <span key={s.id} className="inline-flex items-center gap-1 text-xs">
                        <a
                          href={resolveFileUrl(s.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText size={14} /> Sertifikat {p.sertifikatUrl ? i + 2 : i + 1}
                        </a>
                        {canManage && (
                          <button
                            onClick={() => handleDeleteCert(p, s)}
                            aria-label="Hapus sertifikat"
                            className="text-neutral-400 hover:text-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={MEDAL_TONE[p.medali]}>{MEDAL_LABELS[p.medali]}</Badge>
                {canManage && (
                  <>
                    <button
                      onClick={() => setUploadTarget(p)}
                      aria-label="Unggah sertifikat"
                      title="Unggah sertifikat"
                      disabled={uploadingId === p.id}
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Upload size={16} className={uploadingId === p.id ? "animate-pulse" : ""} />
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      aria-label="Ubah"
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      aria-label="Hapus"
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <Modal title={editing ? "Ubah Prestasi" : "Tambah Prestasi"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Nama Kejuaraan" required htmlFor="namaKejuaraan">
              <Input
                id="namaKejuaraan"
                required
                value={form.namaKejuaraan}
                onChange={(e) => setForm((f) => ({ ...f, namaKejuaraan: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tingkat Kejuaraan" required htmlFor="tingkatKejuaraan">
                <Select
                  id="tingkatKejuaraan"
                  required
                  value={form.tingkatKejuaraan}
                  onChange={(v) => setForm((f) => ({ ...f, tingkatKejuaraan: v as CompetitionLevel }))}
                  options={[
                    ...COMPETITION_LEVEL_CHOICES.map((l) => ({ value: l, label: COMPETITION_LEVEL_LABELS[l] })),
                    // Preserve a legacy level (Kota/Provinsi/...) already on the record.
                    ...(COMPETITION_LEVEL_CHOICES.includes(form.tingkatKejuaraan as (typeof COMPETITION_LEVEL_CHOICES)[number])
                      ? []
                      : [{ value: form.tingkatKejuaraan, label: COMPETITION_LEVEL_LABELS[form.tingkatKejuaraan] }]),
                  ]}
                />
              </Field>
              <Field label="Tahun" required htmlFor="tahun">
                <Input
                  id="tahun"
                  type="number"
                  required
                  value={form.tahun}
                  onChange={(e) => setForm((f) => ({ ...f, tahun: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Medali" required htmlFor="medali">
                <Select
                  id="medali"
                  required
                  value={form.medali}
                  onChange={(v) => setForm((f) => ({ ...f, medali: v as Medal }))}
                  options={MEDALS.map((m) => ({ value: m, label: MEDAL_LABELS[m] }))}
                />
              </Field>
              <Field
                label="Peringkat"
                required={form.medali === "NONE"}
                htmlFor="peringkat"
              >
                <Input
                  id="peringkat"
                  type="number"
                  min={1}
                  required={form.medali === "NONE"}
                  value={form.peringkat}
                  onChange={(e) => setForm((f) => ({ ...f, peringkat: e.target.value }))}
                />
              </Field>
            </div>

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

      {/* Drag & drop certificate upload with preview (revisi 2026-07-18) */}
      {uploadTarget && (
        <Modal
          title={`Unggah Sertifikat — ${uploadTarget.namaKejuaraan}`}
          onClose={() => {
            setUploadTarget(null);
            setUploadFile(null);
          }}
        >
          <div className="space-y-4">
            <DropZone
              accept=".pdf,image/*"
              value={uploadFile}
              onChange={setUploadFile}
              sublabel="PDF atau gambar"
            />
            <div className="flex gap-2">
              <Button onClick={handleUploadCert} disabled={!uploadFile}>
                Unggah
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setUploadTarget(null);
                  setUploadFile(null);
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
