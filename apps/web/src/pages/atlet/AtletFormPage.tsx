import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Upload, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import {
  ATHLETE_LEVELS,
  ATHLETE_LEVEL_LABELS,
  ATHLETE_STATUS_LABELS,
  BATAM_KECAMATAN,
  EDUCATION_LEVELS,
  GENDERS,
  GENDER_LABELS,
  UNSCOPED_ADMIN_ROLES,
  type AthleteStatus,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Select, Combobox } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

type RegistrationDocType = "KTP" | "KK" | "AKTA_KELAHIRAN";

const REGISTRATION_DOCS: { type: RegistrationDocType; label: string; required: boolean }[] = [
  { type: "KTP", label: "KTP", required: false },
  { type: "KK", label: "Kartu Keluarga (KK)", required: false },
  { type: "AKTA_KELAHIRAN", label: "Akta Kelahiran", required: false },
];

const MAX_DOC_SIZE_MB = 10;

// Revisi 2026-07-12: the form only offers Aktif/Tidak Aktif; other statuses
// (cedera, pemusatan latihan, mutasi) are set via the Monitoring module.
const FORM_STATUSES: AthleteStatus[] = ["ACTIVE", "INACTIVE"];

interface CaborOption {
  id: string;
  nama: string;
}

interface CaborLainItem {
  cabangOlahragaId: string;
  nomorIndukAtlet: string;
  nomorRegistrasi: string;
}

interface AtletForm {
  nomorIndukAtlet: string;
  nomorRegistrasi: string;
  namaLengkap: string;
  nik: string;
  jenisKelamin: string;
  alamat: string;
  kecamatan: string;
  nomorHp: string;
  email: string;
  cabangOlahragaId: string;
  cabangOlahragaLain: CaborLainItem[];
  statusAtlet: string;
  tingkatAtlet: string;
  pendidikan: string;
  pekerjaan: string;
}

const empty: AtletForm = {
  nomorIndukAtlet: "",
  nomorRegistrasi: "",
  namaLengkap: "",
  nik: "",
  jenisKelamin: "L",
  alamat: "",
  kecamatan: "",
  nomorHp: "",
  email: "",
  cabangOlahragaId: "",
  cabangOlahragaLain: [],
  statusAtlet: "ACTIVE",
  tingkatAtlet: "",
  pendidikan: "",
  pekerjaan: "",
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

/** Module B — create/edit Atlet (Biodata). See specs/004-atlet/spec.md. */
export function AtletFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [form, setForm] = useState<AtletForm>(empty);
  const [showCaborTambahan, setShowCaborTambahan] = useState(false);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDocs, setPendingDocs] = useState<Partial<Record<RegistrationDocType, File>>>({});
  // refs for hidden file inputs so we can reset them
  const fileInputRefs = useRef<Partial<Record<RegistrationDocType, HTMLInputElement | null>>>({});

  useEffect(() => {
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/atlet/${id}`)
      .then((res) => {
        const a = res.data;
        const caborTambahan: CaborLainItem[] = (a.caborTambahan ?? []).map(
          (c: { cabangOlahragaId: string; nomorIndukAtlet?: string; nomorRegistrasi?: string }) => ({
            cabangOlahragaId: c.cabangOlahragaId,
            nomorIndukAtlet: c.nomorIndukAtlet ?? "",
            nomorRegistrasi: c.nomorRegistrasi ?? "",
          }),
        );
        setForm({
          nomorIndukAtlet: a.nomorIndukAtlet ?? "",
          nomorRegistrasi: a.nomorRegistrasi ?? "",
          namaLengkap: a.namaLengkap ?? "",
          nik: a.nik ?? "",
          jenisKelamin: a.jenisKelamin ?? "L",
          alamat: a.alamat ?? "",
          kecamatan: a.kecamatan ?? "",
          nomorHp: a.nomorHp ?? "",
          email: a.email ?? "",
          cabangOlahragaId: a.cabangOlahragaId ?? "",
          cabangOlahragaLain: caborTambahan,
          statusAtlet: a.statusAtlet ?? "ACTIVE",
          tingkatAtlet: a.tingkatAtlet ?? "",
          pendidikan: a.pendidikan ?? "",
          pekerjaan: a.pekerjaan ?? "",
        });
        if (caborTambahan.length > 0) setShowCaborTambahan(true);
      })
      .catch(() => setError("Gagal memuat data atlet."))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleCaborLain(caborId: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      cabangOlahragaLain: checked
        ? [...f.cabangOlahragaLain, { cabangOlahragaId: caborId, nomorIndukAtlet: "", nomorRegistrasi: "" }]
        : f.cabangOlahragaLain.filter((c) => c.cabangOlahragaId !== caborId),
    }));
  }

  function handleDocSelect(type: RegistrationDocType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
      toast.error(`Ukuran file terlalu besar (maks. ${MAX_DOC_SIZE_MB} MB).`);
      event.target.value = "";
      return;
    }
    setPendingDocs((d) => ({ ...d, [type]: file }));
  }

  function removeDoc(type: RegistrationDocType) {
    setPendingDocs((d) => { const n = { ...d }; delete n[type]; return n; });
    const input = fileInputRefs.current[type];
    if (input) input.value = "";
  }

  function updateCaborLainField(caborId: string, field: "nomorIndukAtlet" | "nomorRegistrasi", value: string) {
    setForm((f) => ({
      ...f,
      cabangOlahragaLain: f.cabangOlahragaLain.map((c) =>
        c.cabangOlahragaId === caborId ? { ...c, [field]: value } : c,
      ),
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        nomorIndukAtlet: form.nomorIndukAtlet,
        nomorRegistrasi: form.nomorRegistrasi,
        namaLengkap: form.namaLengkap,
        nik: form.nik,
        jenisKelamin: form.jenisKelamin,
        alamat: form.alamat,
        kecamatan: form.kecamatan || undefined,
        nomorHp: form.nomorHp || undefined,
        email: form.email || undefined,
        cabangOlahragaId: form.cabangOlahragaId || undefined,
        cabangOlahragaLain: form.cabangOlahragaLain,
        statusAtlet: form.statusAtlet,
        tingkatAtlet: form.tingkatAtlet || undefined,
        pendidikan: form.pendidikan || undefined,
        pekerjaan: form.pekerjaan || undefined,
      };
      if (isEdit) {
        await api.patch(`/atlet/${id}`, payload);
        navigate(`/atlet/${id}`);
      } else {
        const res = await api.post("/atlet", payload);
        const atletId = res.data.id as string;
        // Upload any staged registration documents
        const pendingEntries = Object.entries(pendingDocs) as [RegistrationDocType, File][];
        for (const [type, file] of pendingEntries) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("type", type);
          await api.post(`/atlet/${atletId}/documents`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
        navigate(`/atlet/${atletId}`);
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

  const lainOptions = cabors.filter((c) => c.id !== form.cabangOlahragaId);

  return (
    <div>
      <PageHeader title={isEdit ? "Ubah Data Atlet" : "Tambah Atlet"} />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Identitas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama Lengkap" required htmlFor="namaLengkap">
                <Input
                  id="namaLengkap"
                  required
                  value={form.namaLengkap}
                  onChange={(e) => setForm((f) => ({ ...f, namaLengkap: e.target.value }))}
                />
              </Field>
              <Field label="NIK" required htmlFor="nik">
                <Input
                  id="nik"
                  required
                  pattern="\d{16}"
                  title="NIK harus 16 digit angka"
                  value={form.nik}
                  onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value }))}
                />
              </Field>
              <Field label="Nomor Induk Atlet" required htmlFor="nomorIndukAtlet">
                <Input
                  id="nomorIndukAtlet"
                  required
                  value={form.nomorIndukAtlet}
                  onChange={(e) => setForm((f) => ({ ...f, nomorIndukAtlet: e.target.value }))}
                />
              </Field>
              <Field label="Nomor Registrasi" required htmlFor="nomorRegistrasi">
                <Input
                  id="nomorRegistrasi"
                  required
                  value={form.nomorRegistrasi}
                  onChange={(e) => setForm((f) => ({ ...f, nomorRegistrasi: e.target.value }))}
                />
              </Field>
              <Field label="Jenis Kelamin" required htmlFor="jenisKelamin">
                <Select
                  id="jenisKelamin"
                  required
                  value={form.jenisKelamin}
                  onChange={(v) => setForm((f) => ({ ...f, jenisKelamin: v }))}
                  options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Alamat & Kontak</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Alamat" required htmlFor="alamat">
                <Input
                  id="alamat"
                  required
                  value={form.alamat}
                  onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
                />
              </Field>
              <Field label="Kecamatan" htmlFor="kecamatan">
                <Select
                  id="kecamatan"
                  value={form.kecamatan}
                  onChange={(v) => setForm((f) => ({ ...f, kecamatan: v }))}
                  options={[{ value: "", label: "Pilih kecamatan" }, ...BATAM_KECAMATAN.map((k) => ({ value: k, label: k }))]}
                />
              </Field>
              <Field label="Nomor HP" htmlFor="nomorHp">
                <Input
                  id="nomorHp"
                  pattern="\d+"
                  title="Nomor HP harus berupa angka"
                  value={form.nomorHp}
                  onChange={(e) => setForm((f) => ({ ...f, nomorHp: e.target.value }))}
                />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Cabang Olahraga & Status</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {isUnscopedAdmin ? (
                <Field label="Cabang Olahraga (Utama)" required htmlFor="cabangOlahragaId">
                  <Combobox
                    id="cabangOlahragaId"
                    required
                    value={form.cabangOlahragaId}
                    onChange={(v) => setForm((f) => ({ ...f, cabangOlahragaId: v }))}
                    options={cabors.map((c) => ({ value: c.id, label: c.nama }))}
                    placeholder="Pilih cabang olahraga"
                  />
                </Field>
              ) : isEdit ? (
                <Field label="Cabang Olahraga (Utama)" htmlFor="cabangOlahragaIdDisabled">
                  <Input
                    id="cabangOlahragaIdDisabled"
                    disabled
                    value={cabors.find((c) => c.id === form.cabangOlahragaId)?.nama ?? ""}
                  />
                </Field>
              ) : null}
              <Field label="Status Atlet" required htmlFor="statusAtlet">
                <Select
                  id="statusAtlet"
                  required
                  value={form.statusAtlet}
                  onChange={(v) => setForm((f) => ({ ...f, statusAtlet: v }))}
                  options={[
                    ...FORM_STATUSES.map((s) => ({ value: s, label: ATHLETE_STATUS_LABELS[s] })),
                    // Preserve a non-form status (cedera/pelatnas/mutasi) already on the record.
                    ...(form.statusAtlet && !FORM_STATUSES.includes(form.statusAtlet as AthleteStatus)
                      ? [{ value: form.statusAtlet, label: ATHLETE_STATUS_LABELS[form.statusAtlet as AthleteStatus] }]
                      : []),
                  ]}
                />
              </Field>
              <Field label="Tingkat Atlet" htmlFor="tingkatAtlet">
                <Select
                  id="tingkatAtlet"
                  value={form.tingkatAtlet}
                  onChange={(v) => setForm((f) => ({ ...f, tingkatAtlet: v }))}
                  options={[
                    { value: "", label: "Belum ditentukan" },
                    ...ATHLETE_LEVELS.map((l) => ({ value: l, label: ATHLETE_LEVEL_LABELS[l] })),
                  ]}
                />
              </Field>
            </div>

            {lainOptions.length > 0 && (
              <Field label="Cabang Olahraga Tambahan">
                <label className="mb-2 flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={showCaborTambahan}
                    onChange={(e) => {
                      setShowCaborTambahan(e.target.checked);
                      if (!e.target.checked) setForm((f) => ({ ...f, cabangOlahragaLain: [] }));
                    }}
                  />
                  Atlet ini juga berkompetisi di cabang olahraga lain
                </label>
                {showCaborTambahan && (
                  <div className="ml-1 space-y-3">
                    {lainOptions.map((c) => {
                      const selected = form.cabangOlahragaLain.find((x) => x.cabangOlahragaId === c.id);
                      return (
                        <div key={c.id} className="rounded-md border border-neutral-200 p-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                            <input
                              type="checkbox"
                              checked={Boolean(selected)}
                              onChange={(e) => toggleCaborLain(c.id, e.target.checked)}
                            />
                            {c.nama}
                          </label>
                          {selected && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <Field label="Nomor Induk Atlet" htmlFor={`nia-${c.id}`}>
                                <Input
                                  id={`nia-${c.id}`}
                                  value={selected.nomorIndukAtlet}
                                  onChange={(e) => updateCaborLainField(c.id, "nomorIndukAtlet", e.target.value)}
                                  placeholder="Opsional"
                                />
                              </Field>
                              <Field label="Nomor Registrasi" htmlFor={`nr-${c.id}`}>
                                <Input
                                  id={`nr-${c.id}`}
                                  value={selected.nomorRegistrasi}
                                  onChange={(e) => updateCaborLainField(c.id, "nomorRegistrasi", e.target.value)}
                                  placeholder="Opsional"
                                />
                              </Field>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Field>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Lainnya</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Pendidikan Terakhir" htmlFor="pendidikan">
                <Select
                  id="pendidikan"
                  value={form.pendidikan}
                  onChange={(v) => setForm((f) => ({ ...f, pendidikan: v }))}
                  options={[
                    { value: "", label: "Pilih jenjang" },
                    ...EDUCATION_LEVELS.map((e) => ({ value: e, label: e })),
                    // Preserve legacy free-text values already on the record.
                    ...(form.pendidikan && !EDUCATION_LEVELS.includes(form.pendidikan as (typeof EDUCATION_LEVELS)[number])
                      ? [{ value: form.pendidikan, label: form.pendidikan }]
                      : []),
                  ]}
                />
              </Field>
              <Field label="Pekerjaan" htmlFor="pekerjaan">
                <Input
                  id="pekerjaan"
                  value={form.pekerjaan}
                  onChange={(e) => setForm((f) => ({ ...f, pekerjaan: e.target.value }))}
                />
              </Field>
            </div>
          </section>

          {!isEdit && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Dokumen Registrasi
                <span className="ml-1.5 text-xs font-normal text-neutral-500">(semua opsional, maks. {MAX_DOC_SIZE_MB} MB)</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {REGISTRATION_DOCS.map(({ type, label }) => {
                  const file = pendingDocs[type];
                  return (
                    <div
                      key={type}
                      className={`relative flex flex-col gap-2 rounded-lg border p-3 text-sm ${
                        file
                          ? "border-success bg-success/5"
                          : "border-neutral-200 bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {file ? (
                          <CheckCircle2 size={16} className="shrink-0 text-success" />
                        ) : (
                          <XCircle size={16} className="shrink-0 text-neutral-300" />
                        )}
                        <span className="font-medium text-neutral-800">{label}</span>
                      </div>
                      {file ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-neutral-500">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDoc(type)}
                            className="shrink-0 text-xs text-danger hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-primary hover:underline">
                          <Upload size={13} />
                          Unggah
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            className="hidden"
                            ref={(el) => { fileInputRefs.current[type] = el; }}
                            onChange={(e) => handleDocSelect(type, e)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
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
