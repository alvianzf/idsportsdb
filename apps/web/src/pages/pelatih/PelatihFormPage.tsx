import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Textarea, Combobox } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface CaborOption {
  id: string;
  nama: string;
}

interface PelatihForm {
  namaPelatih: string;
  nomorLisensi: string;
  cabangOlahragaId: string;
  tingkatanLisensi: string;
  masaBerlakuMulai: string;
  masaBerlakuAkhir: string;
  riwayatKepelatihan: string;
}

const empty: PelatihForm = {
  namaPelatih: "",
  nomorLisensi: "",
  cabangOlahragaId: "",
  tingkatanLisensi: "",
  masaBerlakuMulai: "",
  masaBerlakuAkhir: "",
  riwayatKepelatihan: "",
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

/** Module C — create/edit Pelatih. See specs/005-pelatih/spec.md. */
export function PelatihFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [form, setForm] = useState<PelatihForm>(empty);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isUnscopedAdmin) {
      api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
    }
  }, [isUnscopedAdmin]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/pelatih/${id}`)
      .then((res) => {
        const p = res.data;
        setForm({
          namaPelatih: p.namaPelatih ?? "",
          nomorLisensi: p.nomorLisensi ?? "",
          cabangOlahragaId: p.cabangOlahragaId ?? "",
          tingkatanLisensi: p.tingkatanLisensi ?? "",
          masaBerlakuMulai: p.masaBerlakuMulai ? p.masaBerlakuMulai.slice(0, 10) : "",
          masaBerlakuAkhir: p.masaBerlakuAkhir ? p.masaBerlakuAkhir.slice(0, 10) : "",
          riwayatKepelatihan: p.riwayatKepelatihan ?? "",
        });
      })
      .catch(() => setError("Gagal memuat data pelatih."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        namaPelatih: form.namaPelatih,
        nomorLisensi: form.nomorLisensi,
        cabangOlahragaId: form.cabangOlahragaId || undefined,
        tingkatanLisensi: form.tingkatanLisensi,
        masaBerlakuMulai: form.masaBerlakuMulai || undefined,
        masaBerlakuAkhir: form.masaBerlakuAkhir || undefined,
        riwayatKepelatihan: form.riwayatKepelatihan || undefined,
      };
      if (isEdit) {
        await api.patch(`/pelatih/${id}`, payload);
        navigate(`/pelatih/${id}`);
      } else {
        const res = await api.post("/pelatih", payload);
        navigate(`/pelatih/${res.data.id}`);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card className="text-sm text-neutral-500">Memuat data...</Card>;
  }

  return (
    <div>
      <PageHeader title={isEdit ? "Ubah Pelatih" : "Tambah Pelatih"} />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nama Pelatih" required htmlFor="namaPelatih">
              <Input
                id="namaPelatih"
                required
                value={form.namaPelatih}
                onChange={(e) => setForm((f) => ({ ...f, namaPelatih: e.target.value }))}
              />
            </Field>
            <Field label="Nomor Lisensi" required htmlFor="nomorLisensi">
              <Input
                id="nomorLisensi"
                required
                value={form.nomorLisensi}
                onChange={(e) => setForm((f) => ({ ...f, nomorLisensi: e.target.value }))}
              />
            </Field>
            {isUnscopedAdmin && (
              <Field label="Cabang Olahraga" required htmlFor="cabangOlahragaId">
                <Combobox
                  id="cabangOlahragaId"
                  required
                  value={form.cabangOlahragaId}
                  onChange={(v) => setForm((f) => ({ ...f, cabangOlahragaId: v }))}
                  options={cabors.map((c) => ({ value: c.id, label: c.nama }))}
                  placeholder="Pilih cabang olahraga"
                />
              </Field>
            )}
            <Field label="Tingkatan Lisensi" required htmlFor="tingkatanLisensi">
              <Input
                id="tingkatanLisensi"
                required
                placeholder="contoh: Nasional, Internasional"
                value={form.tingkatanLisensi}
                onChange={(e) => setForm((f) => ({ ...f, tingkatanLisensi: e.target.value }))}
              />
            </Field>
            <Field label="Masa Berlaku Mulai" htmlFor="masaBerlakuMulai">
              <Input
                id="masaBerlakuMulai"
                type="date"
                value={form.masaBerlakuMulai}
                onChange={(e) => setForm((f) => ({ ...f, masaBerlakuMulai: e.target.value }))}
              />
            </Field>
            <Field label="Masa Berlaku Akhir" htmlFor="masaBerlakuAkhir">
              <Input
                id="masaBerlakuAkhir"
                type="date"
                value={form.masaBerlakuAkhir}
                onChange={(e) => setForm((f) => ({ ...f, masaBerlakuAkhir: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Riwayat Kepelatihan" htmlFor="riwayatKepelatihan">
            <Textarea
              id="riwayatKepelatihan"
              value={form.riwayatKepelatihan}
              onChange={(e) => setForm((f) => ({ ...f, riwayatKepelatihan: e.target.value }))}
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
