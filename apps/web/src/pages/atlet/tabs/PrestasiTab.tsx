import { useEffect, useState, type FormEvent } from "react";
import {
  Download,
  Eye,
  FileText,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  COMPETITION_LEVEL_CHOICES,
  COMPETITION_LEVEL_LABELS,
  competitionLevelLabel,
  MEDALS,
  MEDAL_LABELS,
  type CompetitionLevel,
  type Medal,
} from "@inasportdb/shared-types";
import { Card, Button, Badge, DropZone, Field, Input, Lightbox, SearchInput, Select, Modal } from "../../../components/ui";
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
  kategori: string | null;
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
  kategori: string;
  tahun: string;
  medali: Medal;
  peringkat: string;
}

const emptyForm: PrestasiForm = {
  namaKejuaraan: "",
  tingkatKejuaraan: "KEJURDA",
  kategori: "",
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

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
}

/**
 * Certificates of one prestasi as uniform rows — the legacy single
 * `sertifikatUrl` first, then the multi-upload `sertifikats`. `key` is unique
 * across prestasi so one expanded row doesn't open its twin elsewhere; `id` is
 * what the delete endpoint expects ("legacy" for the pre-2026-07-18 column).
 */
function sertifikatList(p: Prestasi) {
  const rows: { key: string; id: string; label: string; fileUrl: string; uploadedAt: string | null }[] = [];
  if (p.sertifikatUrl) {
    rows.push({ key: `${p.id}-legacy`, id: "legacy", label: "Sertifikat", fileUrl: p.sertifikatUrl, uploadedAt: null });
  }
  p.sertifikats.forEach((s, i) => {
    rows.push({
      key: `${p.id}-${s.id}`,
      id: s.id,
      label: `Sertifikat ${p.sertifikatUrl ? i + 2 : i + 1}`,
      fileUrl: s.fileUrl,
      uploadedAt: s.uploadedAt,
    });
  });
  return rows;
}

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
  // Certificate staged in the create/edit modal, uploaded after the record saves.
  const [certFile, setCertFile] = useState<File | null>(null);
  const [kejuaraanSuggestions, setKejuaraanSuggestions] = useState<string[]>([]);
  // Which dokumen pendukung is open in the lightbox (revisi 2026-07-29): the key
  // from `sertifikatList`, resolved to an index against every certificate on the
  // page so the arrows can page across prestasi.
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);

  useEffect(() => {
    if (!modalOpen) return;
    api
      .get<string[]>("/prestasi/kejuaraan")
      .then((res) => setKejuaraanSuggestions(res.data))
      .catch(() => setKejuaraanSuggestions([]));
  }, [modalOpen]);

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
    setCertFile(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(p: Prestasi) {
    setEditing(p);
    setForm({
      namaKejuaraan: p.namaKejuaraan,
      tingkatKejuaraan: p.tingkatKejuaraan,
      kategori: p.kategori ?? "",
      tahun: String(p.tahun),
      medali: p.medali,
      peringkat: p.peringkat != null ? String(p.peringkat) : "",
    });
    setCertFile(null);
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
        // Always send the field (even "") so clearing it on an edit reaches the
        // server as an explicit clear, not an omitted key a PATCH would ignore.
        kategori: form.kategori,
        tahun: Number(form.tahun),
        medali: form.medali,
        peringkat: form.peringkat ? Number(form.peringkat) : undefined,
      };
      let prestasiId: string;
      if (editing) {
        await api.patch(`/prestasi/${editing.id}`, payload);
        prestasiId = editing.id;
        toast.success("Prestasi berhasil diubah.");
      } else {
        const res = await api.post(`/atlet/${atletId}/prestasi`, payload);
        prestasiId = res.data.id;
        toast.success("Prestasi berhasil ditambahkan.");
      }
      // Revisi 2026-07-18: a certificate can be attached right in the modal.
      if (certFile) {
        const formData = new FormData();
        formData.append("file", certFile);
        await api.post(`/prestasi/${prestasiId}/sertifikat`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const allDocs = (items ?? []).flatMap((p) =>
    sertifikatList(p).map((d) => ({ key: d.key, label: `${p.namaKejuaraan} — ${d.label}`, fileUrl: d.fileUrl })),
  );
  const lightboxIndex = allDocs.findIndex((d) => d.key === lightboxKey);

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
          {items.map((p) => {
            const docs = sertifikatList(p);
            return (
              <li key={p.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">{p.namaKejuaraan}</p>
                    <p className="text-neutral-500">
                      {competitionLevelLabel(p.tingkatKejuaraan)} &middot; {p.tahun}
                      {p.kategori ? ` \u00b7 ${p.kategori}` : ""}
                      {p.peringkat ? ` \u00b7 Peringkat ${p.peringkat}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={MEDAL_TONE[p.medali]}>{MEDAL_LABELS[p.medali]}</Badge>
                    {canManage && (
                      <>
                        <button
                          onClick={() => setUploadTarget(p)}
                          aria-label="Unggah sertifikat"
                          title="Unggah sertifikat"
                          disabled={uploadingId === p.id}
                          className="rounded-md p-1.5 text-neutral-500 hover:bg-primary-50 hover:text-primary"
                        >
                          <Upload size={16} className={uploadingId === p.id ? "animate-pulse" : ""} />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          aria-label="Ubah"
                          className="rounded-md p-1.5 text-neutral-500 hover:bg-primary-50 hover:text-primary"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          aria-label="Hapus"
                          className="rounded-md p-1.5 text-neutral-500 hover:bg-primary-50 hover:text-primary"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Revisi 2026-07-27: dokumen pendukung tampil sebagai row tambahan
                    di bawah prestasinya, bisa dibuka untuk pratinjau langsung. */}
                {docs.length > 0 && (
                  <ul className="mt-2 border-l-2 border-neutral-100 pl-3">
                    {docs.map((d) => {
                      const image = isImageUrl(d.fileUrl);
                      return (
                        <li key={d.key}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                            <button
                              type="button"
                              onClick={() => setLightboxKey(d.key)}
                              title="Lihat sertifikat"
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-neutral-700 hover:text-primary"
                            >
                              <Eye size={14} className="shrink-0 text-neutral-400" />
                              {image ? (
                                <ImageIcon size={14} className="shrink-0 text-neutral-400" />
                              ) : (
                                <FileText size={14} className="shrink-0 text-neutral-400" />
                              )}
                              <span className="truncate text-xs font-medium">{d.label}</span>
                            </button>
                            {d.uploadedAt && (
                              <span className="shrink-0 text-xs text-neutral-400">
                                {new Date(d.uploadedAt).toLocaleDateString("id-ID")}
                              </span>
                            )}
                            <a
                              href={resolveFileUrl(d.fileUrl)}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Unduh"
                              title="Unduh"
                              className="shrink-0 rounded p-1 text-neutral-400 hover:text-primary"
                            >
                              <Download size={13} />
                            </a>
                            {canManage && (
                              <button
                                onClick={() => handleDeleteCert(p, { id: d.id, fileUrl: d.fileUrl, uploadedAt: d.uploadedAt ?? "" })}
                                aria-label="Hapus sertifikat"
                                className="shrink-0 rounded p-1 text-neutral-400 hover:text-danger"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <Modal title={editing ? "Ubah Prestasi" : "Tambah Prestasi"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Nama Kejuaraan" required htmlFor="namaKejuaraan">
              {/* Suggests editions already recorded ("Porprov Kepri 2026") so the
                  same championship isn't spelled three different ways. */}
              <SearchInput
                id="namaKejuaraan"
                required
                showIcon={false}
                placeholder="Contoh: Porprov Kepri 2026"
                value={form.namaKejuaraan}
                onChange={(v) => setForm((f) => ({ ...f, namaKejuaraan: v }))}
                suggestions={kejuaraanSuggestions}
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
            <Field label="Kategori" htmlFor="kategori">
              <Input
                id="kategori"
                placeholder="Contoh: Kelas 58kg Putra"
                value={form.kategori}
                onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value }))}
              />
            </Field>
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

            {/* Revisi 2026-07-18: attach a certificate right here (full width). */}
            <Field label="Sertifikat" htmlFor="sertifikatFile">
              <DropZone
                accept=".pdf,image/*"
                value={certFile}
                onChange={setCertFile}
                sublabel="PDF atau gambar"
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

      {/* Revisi 2026-07-29: sertifikat dibuka di lightbox, tidak pindah halaman. */}
      {lightboxIndex >= 0 && (
        <Lightbox
          items={allDocs}
          index={lightboxIndex}
          onIndexChange={(i) => setLightboxKey(allDocs[i].key)}
          onClose={() => setLightboxKey(null)}
        />
      )}
    </Card>
  );
}
