import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, PageHeader, Button, Field, Input, DropZone } from "../../components/ui";
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


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

  function handleLogoFileChange(file: File | null) {
    setLogoFile(file);
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

      let caborId = id;
      if (isEdit) {
        await api.patch(`/cabor/${id}`, payload);
      } else {
        const res = await api.post("/cabor", payload);
        caborId = res.data.id;
      }

      // Upload staged logo after the record is saved
      if (logoFile && caborId) {
        setUploadingLogo(true);
        const fd = new FormData();
        fd.append("file", logoFile);
        await api.post(`/cabor/${caborId}/logo`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUploadingLogo(false);
        setLogoFile(null);
      }

      navigate(`/cabor/${caborId}`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        "Gagal menyimpan data.";
      setError(typeof message === "string" ? message : "Gagal menyimpan data.");
    } finally {
      setSaving(false);
      setUploadingLogo(false);
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
            <Field label="Logo Organisasi">
              <DropZone
                accept="image/*"
                value={logoFile}
                existingUrl={logoUrl ? resolveFileUrl(logoUrl) : null}
                onChange={handleLogoFileChange}
                disabled={uploadingLogo}
                sublabel="PNG, JPG, SVG — maks. 5 MB"
                label={uploadingLogo ? "Mengunggah..." : "Seret & lepas logo di sini"}
              />
            </Field>
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
