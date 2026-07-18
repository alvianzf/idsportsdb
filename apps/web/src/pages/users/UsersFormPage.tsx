import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Select } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface CaborOption { id: string; nama: string; }
interface AtletOption { id: string; namaLengkap: string; nomorIndukAtlet: string; }

interface UserForm {
  email: string;
  fullName: string;
  role: Role;
  cabangOlahragaId: string;
  athleteId: string;
}

interface CreatedAccount {
  email: string;
  password: string;
  emailSent: boolean;
}

function extractError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
  if (typeof data === "string") return data;
  return "Gagal menyimpan data.";
}

// Revisi 2026-07-18: `embedded` renders the create form inside a modal on the
// users list — no PageHeader, and `onDone` replaces navigation when finished.
export function UsersFormPage({ embedded = false, onDone }: { embedded?: boolean; onDone?: () => void } = {}) {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentRole = useAuthStore((state) => state.user?.role);

  // #68 — "Buatkan Akun" shortcut deep-links here with the athlete pre-selected.
  const athleteIdParam = searchParams.get("athleteId") ?? "";
  const athleteLocked = !isEdit && Boolean(athleteIdParam);

  // Assignable roles by actor (the API enforces these limits too):
  // ADMIN_CABOR → ATLET only; ADMIN_KONI → ADMIN_CABOR + ATLET (never SUPER/ADMIN_KONI).
  const allowedRoles: readonly Role[] =
    currentRole === "ADMIN_CABOR"
      ? (["ATLET"] as const)
      : currentRole === "ADMIN_KONI"
        ? (["ADMIN_CABOR", "ADMIN_DISPORA", "ATLET"] as const)
        : ROLES;
  const defaultRole: Role =
    athleteLocked || currentRole === "ADMIN_CABOR"
      ? "ATLET"
      : currentRole === "ADMIN_KONI"
        ? "ADMIN_CABOR"
        : "ADMIN_KONI";

  const [form, setForm] = useState<UserForm>({
    email: "",
    fullName: "",
    role: defaultRole,
    cabangOlahragaId: "",
    athleteId: athleteIdParam,
  });
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [atlets, setAtlets] = useState<AtletOption[]>([]);
  const [atletSearch, setAtletSearch] = useState("");
  const [lockedAtletLabel, setLockedAtletLabel] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  // ADMIN_KONI may not act on SUPER_ADMIN_KONI / ADMIN_KONI accounts (API 403s too).
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
  }, []);

  // Server-side search so athletes beyond the first page are reachable.
  useEffect(() => {
    if (athleteLocked) return;
    let cancelled = false;
    api
      .get<{ items: AtletOption[] }>("/atlet", {
        params: { search: atletSearch || undefined, pageSize: 200 },
      })
      .then((res) => { if (!cancelled) setAtlets(res.data.items); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [atletSearch, athleteLocked]);

  // Prefill the athlete (name + email) for the "Buatkan Akun" shortcut.
  useEffect(() => {
    if (!athleteLocked) return;
    api
      .get(`/atlet/${athleteIdParam}`)
      .then((res) => {
        const a = res.data;
        setLockedAtletLabel(`${a.namaLengkap} (${a.nomorIndukAtlet})`);
        setForm((f) => ({
          ...f,
          fullName: f.fullName || a.namaLengkap || "",
          email: f.email || a.email || "",
        }));
      })
      .catch(() => setError("Gagal memuat data atlet."));
  }, [athleteLocked, athleteIdParam]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/users/${id}`)
      .then((res) => {
        const u = res.data;
        if (
          currentRole === "ADMIN_KONI" &&
          (u.role === "SUPER_ADMIN_KONI" || u.role === "ADMIN_KONI")
        ) {
          setForbidden(true);
          return;
        }
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
  }, [id, currentRole]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit) {
        // Two separate endpoints (name/email, then role+scoping). If the second
        // fails the first has already persisted, so reconcile the form with the
        // server's actual state and tell the user exactly what did save.
        await api.patch(`/users/${id}`, { fullName: form.fullName, email: form.email });
        try {
          await api.patch(`/users/${id}/role`, {
            role: form.role,
            cabangOlahragaId: form.role === "ADMIN_CABOR" ? form.cabangOlahragaId || null : null,
            athleteId: form.role === "ATLET" ? form.athleteId || null : null,
          });
        } catch (roleErr) {
          try {
            const res = await api.get(`/users/${id}`);
            const u = res.data;
            setForm({
              email: u.email ?? "",
              fullName: u.fullName ?? "",
              role: u.role ?? "ADMIN_KONI",
              cabangOlahragaId: u.cabangOlahragaId ?? "",
              athleteId: u.athleteId ?? "",
            });
          } catch {
            // Reconciling refetch failed too — leave the form as-is.
          }
          setError(
            `Nama dan email tersimpan, tetapi perubahan peran gagal (${extractError(roleErr)}). Form dimuat ulang — silakan coba ubah peran lagi.`,
          );
          return;
        }
        toast.success("Pengguna berhasil diubah.");
        navigate("/users");
      } else {
        const res = await api.post<{ generatedPassword: string; emailSent: boolean }>("/users", {
          email: form.email,
          fullName: form.fullName,
          role: form.role,
          cabangOlahragaId: form.role === "ADMIN_CABOR" ? form.cabangOlahragaId || undefined : undefined,
          athleteId: form.role === "ATLET" ? form.athleteId || undefined : undefined,
        });
        // Reveal the one-time password + email status instead of navigating away,
        // so the admin has a fallback when SMTP fails (#68).
        setCreated({
          email: form.email,
          password: res.data.generatedPassword,
          emailSent: Boolean(res.data.emailSent),
        });
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function copyPassword() {
    if (!created) return;
    navigator.clipboard
      .writeText(created.password)
      .then(() => toast.success("Kata sandi disalin."))
      .catch(() => toast.error("Gagal menyalin kata sandi."));
  }

  function finishCreate() {
    if (embedded) {
      onDone?.();
      return;
    }
    navigate(athleteLocked ? `/atlet/${athleteIdParam}` : "/users");
  }

  if (loading) {
    return <Card className="text-sm text-neutral-500">Memuat data...</Card>;
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader title="Ubah Pengguna" />
        <Card className="space-y-4">
          <p className="text-sm text-danger">
            Anda tidak memiliki izin untuk mengubah akun Super Admin atau Admin KONI.
          </p>
          <Button type="button" variant="outline" onClick={() => navigate("/users")}>
            Kembali
          </Button>
        </Card>
      </div>
    );
  }

  if (created) {
    return (
      <div>
        {!embedded && <PageHeader title="Akun Berhasil Dibuat" />}
        <Card className="space-y-4">
          <p className="text-sm text-neutral-600">
            {created.emailSent
              ? "Email berisi kredensial telah dikirim. Kata sandi di bawah hanya ditampilkan sekali sebagai cadangan."
              : "Email gagal dikirim. Serahkan kata sandi di bawah ini secara langsung — ini hanya ditampilkan sekali."}
          </p>
          <div className="space-y-2 rounded-lg bg-neutral-50 p-4">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-neutral-500">Email</span>
              <span className="font-medium text-neutral-900">{created.email}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-neutral-500">Kata Sandi</span>
              <span className="flex items-center gap-2">
                <code className="font-mono font-semibold text-neutral-900">{created.password}</code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="text-neutral-500 hover:text-neutral-700"
                  title="Salin kata sandi"
                >
                  <Copy size={16} />
                </button>
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-neutral-500">Status Email</span>
              <span className={created.emailSent ? "font-medium text-emerald-600" : "font-medium text-danger"}>
                {created.emailSent ? "Terkirim" : "Gagal terkirim"}
              </span>
            </div>
          </div>
          <Button type="button" onClick={finishCreate}>Selesai</Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {!embedded && <PageHeader title={isEdit ? "Ubah Pengguna" : "Tambah Pengguna"} />}
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
                disabled={athleteLocked || allowedRoles.length === 1}
                value={form.role}
                onChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                options={allowedRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              />
            </Field>
          </div>

          {form.role === "ADMIN_CABOR" && (
            <Field label="Cabang Olahraga" required htmlFor="cabangOlahragaId">
              <Select
                id="cabangOlahragaId"
                required
                value={form.cabangOlahragaId}
                onChange={(v) => setForm((f) => ({ ...f, cabangOlahragaId: v }))}
                options={[{ value: "", label: "Pilih cabang olahraga" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
              />
            </Field>
          )}

          {form.role === "ATLET" && (
            athleteLocked ? (
              <Field label="Akun Atlet" htmlFor="athleteLabel">
                <Input id="athleteLabel" value={lockedAtletLabel} disabled readOnly />
              </Field>
            ) : (
              <Field label="Akun Atlet" required htmlFor="athleteId">
                <Input
                  placeholder="Cari nama atau nomor induk atlet..."
                  value={atletSearch}
                  onChange={(e) => setAtletSearch(e.target.value)}
                  className="mb-2"
                />
                <Select
                  id="athleteId"
                  required
                  value={form.athleteId}
                  onChange={(v) => setForm((f) => ({ ...f, athleteId: v }))}
                  options={[{ value: "", label: "Pilih atlet" }, ...atlets.map((a) => ({ value: a.id, label: `${a.namaLengkap} (${a.nomorIndukAtlet})` }))]}
                />
              </Field>
            )
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => (embedded ? onDone?.() : navigate(-1))}>
              Batal
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
