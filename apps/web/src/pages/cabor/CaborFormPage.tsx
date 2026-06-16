import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, PageHeader, Button, Field, Input } from "../../components/ui";
import { api } from "../../lib/api";

interface CaborForm {
  nama: string;
  ketuaCabor: string;
  sekretariat: string;
}

const empty: CaborForm = { nama: "", ketuaCabor: "", sekretariat: "" };

/** Module E — create/edit Cabang Olahraga. See specs/003-cabang-olahraga/spec.md. */
export function CaborFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<CaborForm>(empty);
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
        });
      })
      .catch(() => setError("Gagal memuat data cabang olahraga."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        nama: form.nama,
        ketuaCabor: form.ketuaCabor || undefined,
        sekretariat: form.sekretariat || undefined,
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
