import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ROLES, ROLE_LABELS, type Role } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Select } from "../../components/ui";
import { api } from "../../lib/api";

interface CaborOption { id: string; nama: string; }
interface AtletOption { id: string; namaLengkap: string; nomorIndukAtlet: string; }

interface UserForm {
  email: string;
  fullName: string;
  role: Role;
  cabangOlahragaId: string;
  athleteId: string;
}

const empty: UserForm = {
  email: "",
  fullName: "",
  role: "ADMIN_KONI",
  cabangOlahragaId: "",
  athleteId: "",
};

function extractError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
  if (typeof data === "string") return data;
  return "Gagal menyimpan data.";
}

export function UsersFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<UserForm>(empty);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [atlets, setAtlets] = useState<AtletOption[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
    api
      .get<{ items: AtletOption[] }>("/atlet", { params: { pageSize: 200 } })
      .then((res) => setAtlets(res.data.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/users/${id}`)
      .then((res) => {
        const u = res.data;
        setForm({
          email: u.email ?? "",
          fullName: u.fullName ?? "",
          role: u.role ?? "ADMIN_KONI",
          cabangOlahragaId: u.cabangOlahragaId ?? "",
          athleteId: u.athleteId ?? "",
        });
      })
      .catch(() => setError("Gagal memuat data pengguna."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/users/${id}`, { fullName: form.fullName, email: form.email });
        await api.patch(`/users/${id}/role`, {
          role: form.role,
          cabangOlahragaId: form.role === "ADMIN_CABOR" ? form.cabangOlahragaId || null : null,
          athleteId: form.role === "ATLET" ? form.athleteId || null : null,
        });
        toast.success("Pengguna berhasil diubah.");
      } else {
        await api.post("/users", {
          email: form.email,
          fullName: form.fullName,
          role: form.role,
          cabangOlahragaId: form.role === "ADMIN_CABOR" ? form.cabangOlahragaId || undefined : undefined,
          athleteId: form.role === "ATLET" ? form.athleteId || undefined : undefined,
        });
        toast.success("Pengguna berhasil ditambahkan. Email dengan kata sandi dikirim otomatis.");
      }
      navigate("/users");
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
      <PageHeader title={isEdit ? "Ubah Pengguna" : "Tambah Pengguna"} />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nama Lengkap" required htmlFor="fullName">
              <Input
                id="fullName"
                required
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </Field>
            <Field label="Email" required htmlFor="email">
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Role" required htmlFor="role">
              <Select
                id="role"
                required
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </Select>
            </Field>
          </div>

          {form.role === "ADMIN_CABOR" && (
            <Field label="Cabang Olahraga" required htmlFor="cabangOlahragaId">
              <Select
                id="cabangOlahragaId"
                required
                value={form.cabangOlahragaId}
                onChange={(e) => setForm((f) => ({ ...f, cabangOlahragaId: e.target.value }))}
              >
                <option value="">Pilih cabang olahraga</option>
                {cabors.map((c) => (
                  <option key={c.id} value={c.id}>{c.nama}</option>
                ))}
              </Select>
            </Field>
          )}

          {form.role === "ATLET" && (
            <Field label="Akun Atlet" required htmlFor="athleteId">
              <Select
                id="athleteId"
                required
                value={form.athleteId}
                onChange={(e) => setForm((f) => ({ ...f, athleteId: e.target.value }))}
              >
                <option value="">Pilih atlet</option>
                {atlets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.namaLengkap} ({a.nomorIndukAtlet})
                  </option>
                ))}
              </Select>
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
