import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  ATHLETE_LEVELS,
  ATHLETE_LEVEL_LABELS,
  ATHLETE_STATUS_LABELS,
  BATAM_KECAMATAN,
  COMPETITION_LEVEL_CHOICES,
  COMPETITION_LEVEL_LABELS,
  EDUCATION_LEVELS,
  GENDERS,
  GENDER_LABELS,
  MEDALS,
  MEDAL_LABELS,
  UNSCOPED_ADMIN_ROLES,
  type AthleteStatus,
  type CompetitionLevel,
  type Medal,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Button, DropZone, Field, Input, SearchInput, Select, Textarea, Combobox } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// Revisi 2026-07-12: the form offers the plain administrative statuses; TC and
// mutasi are set via the Monitoring module. Revisi 2026-07-18: Cedera and
// Pensiun are selectable here too (Cedera asks for tanggal + keterangan).
const FORM_STATUSES: AthleteStatus[] = ["ACTIVE", "INACTIVE", "INJURED", "RETIRED"];

interface CaborOption {
  id: string;
  nama: string;
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
  statusAtlet: string;
  tanggalCedera: string;
  keteranganCedera: string;
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
  statusAtlet: "ACTIVE",
  tanggalCedera: "",
  keteranganCedera: "",
  tingkatAtlet: "",
  pendidikan: "",
  pekerjaan: "",
};

/** A prestasi typed into the create form, before the atlet exists to hang it on. */
interface PrestasiDraft {
  namaKejuaraan: string;
  tingkatKejuaraan: CompetitionLevel;
  kategori: string;
  tahun: string;
  medali: Medal;
  peringkat: string;
  certFile: File | null;
}

function emptyPrestasi(): PrestasiDraft {
  return {
    namaKejuaraan: "",
    tingkatKejuaraan: "KEJURDA",
    kategori: "",
    tahun: String(new Date().getFullYear()),
    medali: "GOLD",
    peringkat: "",
    certFile: null,
  };
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

/** Module B — create/edit Atlet (Biodata). See specs/004-atlet/spec.md. */
export function AtletFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [form, setForm] = useState<AtletForm>(empty);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks an athlete created in a prior submit attempt so a retry after a
  // failed document upload continues rather than creating a duplicate.
  const createdAtletIdRef = useRef<string | undefined>(undefined);
  // Prestasi entered inline on create. Editing keeps using the Prestasi tab on
  // the detail page, which already handles the full list.
  const [prestasis, setPrestasis] = useState<PrestasiDraft[]>([]);
  const [kejuaraanSuggestions, setKejuaraanSuggestions] = useState<string[]>([]);
  // Same retry guard as the athlete: prestasi created in a failed attempt are
  // reused by index instead of being POSTed twice.
  const createdPrestasiIdsRef = useRef<(string | undefined)[]>([]);
  // Certificates already uploaded, tracked separately: a retry must not re-POST
  // the file for a row whose prestasi succeeded, or the athlete collects a
  // duplicate certificate on every attempt.
  const uploadedCertRef = useRef<boolean[]>([]);

  function updatePrestasi(index: number, patch: Partial<PrestasiDraft>) {
    setPrestasis((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    // A newly picked file has not been uploaded yet, whatever happened before.
    if ("certFile" in patch) uploadedCertRef.current[index] = false;
  }

  function removePrestasi(index: number) {
    // Created by an earlier failed submit? Delete it, otherwise the record stays
    // on the athlete while the row disappears from the form.
    const createdId = createdPrestasiIdsRef.current[index];
    if (createdId) api.delete(`/prestasi/${createdId}`).catch(() => undefined);
    setPrestasis((rows) => rows.filter((_, i) => i !== index));
    createdPrestasiIdsRef.current.splice(index, 1);
    uploadedCertRef.current.splice(index, 1);
  }

  useEffect(() => {
    api.get<CaborOption[]>(isEdit ? "/cabor" : "/cabor?active=true").then((res) => setCabors(res.data));
  }, []);

  // Only the create form offers prestasi rows, so only it needs the suggestions.
  useEffect(() => {
    if (isEdit) return;
    api
      .get<string[]>("/prestasi/kejuaraan")
      .then((res) => setKejuaraanSuggestions(res.data))
      .catch(() => setKejuaraanSuggestions([]));
  }, [isEdit]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/atlet/${id}`)
      .then((res) => {
        const a = res.data;
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
          statusAtlet: a.statusAtlet ?? "ACTIVE",
          tanggalCedera: a.tanggalCedera ? a.tanggalCedera.slice(0, 10) : "",
          keteranganCedera: a.keteranganCedera ?? "",
          tingkatAtlet: a.tingkatAtlet ?? "",
          pendidikan: a.pendidikan ?? "",
          pekerjaan: a.pekerjaan ?? "",
        });
      })
      .catch(() => setError("Gagal memuat data atlet."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        nomorIndukAtlet: form.nomorIndukAtlet || undefined,
        nomorRegistrasi: form.nomorRegistrasi || undefined,
        namaLengkap: form.namaLengkap,
        nik: form.nik,
        jenisKelamin: form.jenisKelamin,
        alamat: form.alamat,
        kecamatan: form.kecamatan || undefined,
        nomorHp: form.nomorHp || undefined,
        email: form.email || undefined,
        cabangOlahragaId: form.cabangOlahragaId || undefined,
        statusAtlet: form.statusAtlet,
        // null (not undefined) so emptying a field actually clears the stored value.
        tanggalCedera: form.statusAtlet === "INJURED" ? form.tanggalCedera || null : null,
        keteranganCedera: form.statusAtlet === "INJURED" ? form.keteranganCedera || null : null,
        tingkatAtlet: form.tingkatAtlet || undefined,
        pendidikan: form.pendidikan || undefined,
        pekerjaan: form.pekerjaan || undefined,
      };
      if (isEdit) {
        await api.patch(`/atlet/${id}`, payload);
        navigate(`/atlet/${id}`);
      } else {
        // Reuse an athlete created in a prior failed attempt (PATCH) instead of
        // POSTing a duplicate; otherwise create it now.
        let atletId = createdAtletIdRef.current;
        if (atletId) {
          await api.patch(`/atlet/${atletId}`, payload);
        } else {
          const res = await api.post("/atlet", payload);
          atletId = res.data.id as string;
          createdAtletIdRef.current = atletId;
        }
        // A certificate needs a prestasi id and a prestasi needs an atlet id, so
        // these have to run after the athlete exists — sequentially, so the first
        // failure stops the rest and surfaces one error.
        for (const [index, row] of prestasis.entries()) {
          let prestasiId = createdPrestasiIdsRef.current[index];
          if (!prestasiId) {
            const res = await api.post(`/atlet/${atletId}/prestasi`, {
              namaKejuaraan: row.namaKejuaraan,
              tingkatKejuaraan: row.tingkatKejuaraan,
              kategori: row.kategori || undefined,
              tahun: Number(row.tahun),
              medali: row.medali,
              peringkat: row.peringkat ? Number(row.peringkat) : undefined,
            });
            prestasiId = res.data.id as string;
            createdPrestasiIdsRef.current[index] = prestasiId;
          }
          if (row.certFile && !uploadedCertRef.current[index]) {
            const formData = new FormData();
            formData.append("file", row.certFile);
            await api.post(`/prestasi/${prestasiId}/sertifikat`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            uploadedCertRef.current[index] = true;
          }
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

  return (
    <div>
      <PageHeader title={isEdit ? "Ubah Data Atlet" : "Tambah Atlet"} />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Identitas</h2>
            <div className="grid gap-4 lg:grid-cols-2">
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
              <Field label="Nomor Induk Atlet" htmlFor="nomorIndukAtlet">
                <Input
                  id="nomorIndukAtlet"
                  value={form.nomorIndukAtlet}
                  onChange={(e) => setForm((f) => ({ ...f, nomorIndukAtlet: e.target.value }))}
                />
              </Field>
              <Field label="Nomor Registrasi" htmlFor="nomorRegistrasi">
                <Input
                  id="nomorRegistrasi"
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
            <div className="grid gap-4 lg:grid-cols-2">
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
            <div className="grid gap-4 lg:grid-cols-2">
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
              {form.statusAtlet === "INJURED" && (
                <>
                  <Field label="Tanggal Cedera" required htmlFor="tanggalCedera">
                    <Input
                      id="tanggalCedera"
                      type="date"
                      required
                      value={form.tanggalCedera}
                      onChange={(e) => setForm((f) => ({ ...f, tanggalCedera: e.target.value }))}
                    />
                  </Field>
                  <Field label="Keterangan Cedera" htmlFor="keteranganCedera">
                    <Textarea
                      id="keteranganCedera"
                      rows={2}
                      value={form.keteranganCedera}
                      onChange={(e) => setForm((f) => ({ ...f, keteranganCedera: e.target.value }))}
                    />
                  </Field>
                </>
              )}
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
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Lainnya</h2>
            <div className="grid gap-4 lg:grid-cols-2">
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

          {/*
            Prestasi are only offered on create. On edit the Prestasi tab of the
            detail page owns the list (add, edit, delete, multiple certificates).
          */}
          {!isEdit && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Prestasi</h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPrestasis((rows) => [...rows, emptyPrestasi()])}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Prestasi
                </Button>
              </div>

              {prestasis.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Belum ada prestasi. Opsional — bisa juga ditambahkan nanti dari halaman detail atlet.
                </p>
              ) : (
                <div className="space-y-4">
                  {prestasis.map((row, index) => (
                    <div key={index} className="rounded-lg border border-neutral-200 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-700">Prestasi {index + 1}</span>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => removePrestasi(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </Button>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Field label="Nama Kejuaraan" required htmlFor={`namaKejuaraan-${index}`}>
                          {/* Suggests editions already recorded ("Porprov Kepri 2026")
                              so the same championship isn't spelled several ways. */}
                          <SearchInput
                            id={`namaKejuaraan-${index}`}
                            required
                            showIcon={false}
                            placeholder="Contoh: Porprov Kepri 2026"
                            value={row.namaKejuaraan}
                            onChange={(v) => updatePrestasi(index, { namaKejuaraan: v })}
                            suggestions={kejuaraanSuggestions}
                          />
                        </Field>
                        <Field label="Tingkat Kejuaraan" required htmlFor={`tingkat-${index}`}>
                          <Select
                            value={row.tingkatKejuaraan}
                            onChange={(v) => updatePrestasi(index, { tingkatKejuaraan: v as CompetitionLevel })}
                            options={COMPETITION_LEVEL_CHOICES.map((l) => ({ value: l, label: COMPETITION_LEVEL_LABELS[l] }))}
                          />
                        </Field>
                        <Field label="Kategori" htmlFor={`kategori-${index}`}>
                          <Input
                            id={`kategori-${index}`}
                            placeholder="Contoh: Kelas 58kg Putra"
                            value={row.kategori}
                            onChange={(e) => updatePrestasi(index, { kategori: e.target.value })}
                          />
                        </Field>
                        <Field label="Tahun" required htmlFor={`tahun-${index}`}>
                          <Input
                            id={`tahun-${index}`}
                            type="number"
                            required
                            min={1950}
                            max={new Date().getFullYear() + 1}
                            value={row.tahun}
                            onChange={(e) => updatePrestasi(index, { tahun: e.target.value })}
                          />
                        </Field>
                        <Field label="Medali" required htmlFor={`medali-${index}`}>
                          <Select
                            value={row.medali}
                            onChange={(v) => updatePrestasi(index, { medali: v as Medal })}
                            options={MEDALS.map((m) => ({ value: m, label: MEDAL_LABELS[m] }))}
                          />
                        </Field>
                        {/* Server requires peringkat when no medal was won. */}
                        <Field
                          label="Peringkat"
                          required={row.medali === "NONE"}
                          htmlFor={`peringkat-${index}`}
                        >
                          <Input
                            id={`peringkat-${index}`}
                            type="number"
                            min={1}
                            required={row.medali === "NONE"}
                            value={row.peringkat}
                            onChange={(e) => updatePrestasi(index, { peringkat: e.target.value })}
                          />
                        </Field>
                        <div className="lg:col-span-2">
                          <Field label="Sertifikat" htmlFor={`sertifikat-${index}`}>
                            <DropZone
                              accept=".pdf,image/*"
                              value={row.certFile}
                              onChange={(file) => updatePrestasi(index, { certFile: file })}
                              sublabel="PDF atau gambar"
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
