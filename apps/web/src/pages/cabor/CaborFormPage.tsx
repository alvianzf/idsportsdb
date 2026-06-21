import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Upload } from "lucide-react";
import toast from "react-hot-toast";
import { Card, PageHeader, Button, Field, Input } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";

interface CaborForm {
  nama: string;
  ketuaCabor: string;
  sekretariat: string;
  organisasiNasional: string;
}

const empty: CaborForm = { nama: "", ketuaCabor: "", sekretariat: "", organisasiNasional: "" };

/** Module E — create/edit Cabang Olahraga. See specs/003-cabang-olahraga/spec.md. */
export function CaborFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<CaborForm>(empty);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/cabor/${id}`)
      .then((res) => {
        setForm({
          nama: res.data.nama ?? "",
          ketuaCabor: res.data.ketuaCabor ?? "",
          sekretariat: res.data.sekretariat ?? "",
          organisasiNasional: res.data.organisasiNasional ?? "",
        });
        setLogoUrl(res.data.logoOrganisasiUrl ?? null);
      })
      .catch(() => setError("Gagal memuat data cabang olahraga."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`/cabor/${id}/logo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLogoUrl(res.data.logoOrganisasiUrl);
      toast.success("Logo berhasil diunggah.");
    } catch {
      toast.error("Gagal mengunggah logo.");
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        nama: form.nama,
        ketuaCabor: form.ketuaCabor || undefined,
        sekretariat: form.sekretariat || undefined,
        organisasiNasional: form.organisasiNasional || undefined,
      };
      if (isEdit) {
        await api.patch(`/cabor/${id}`, payload);
        navigate(`/cabor/${id}`);
      } else {
        const res = await api.post("/cabor", payload);
        navigate(`/cabor/${res.data.id}`);
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        "Gagal menyimpan data.";
      setError(typeof message === "string" ? message : "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card className="text-sm text-neutral-500">Memuat data...</Card>;
  }

  return (
    <div>
      <PageHeader title={isEdit ? "Ubah Cabang Olahraga" : "Tambah Cabang Olahraga"} />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama Cabang Olahraga" required htmlFor="nama">
            <Input
              id="nama"
              required
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
            />
          </Field>
          <Field label="Ketua Cabor" htmlFor="ketuaCabor">
            <Input
              id="ketuaCabor"
              value={form.ketuaCabor}
              onChange={(e) => setForm((f) => ({ ...f, ketuaCabor: e.target.value }))}
            />
          </Field>
          <Field label="Sekretariat" htmlFor="sekretariat">
            <Input
              id="sekretariat"
              value={form.sekretariat}
              onChange={(e) => setForm((f) => ({ ...f, sekretariat: e.target.value }))}
            />
          </Field>
          <Field label="Organisasi Nasional" htmlFor="organisasiNasional" hint="Mis: FORKI, PBSI, PRSI">
            <Input
              id="organisasiNasional"
              placeholder="Nama organisasi induk nasional"
              value={form.organisasiNasional}
              onChange={(e) => setForm((f) => ({ ...f, organisasiNasional: e.target.value }))}
            />
          </Field>

          {/* Logo upload — only available when editing an existing cabor */}
          {isEdit && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Logo Organisasi</p>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={resolveFileUrl(logoUrl)}
                    alt="Logo"
                    className="h-16 w-16 rounded-lg border border-neutral-200 object-contain p-1"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-400">
                    Belum ada
                  </div>
                )}
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-primary hover:text-primary transition">
                    <Upload size={14} /> {uploadingLogo ? "Mengunggah..." : "Unggah Logo"}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-neutral-400">PNG, JPG, SVG — maks. 5 MB</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Batal
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
