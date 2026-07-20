import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { BATAM_KECAMATAN, EDUCATION_LEVELS } from "@inasportdb/shared-types";
import { PageHeader, Button, Field, Input, Select, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import type { AtletDetail } from "./types";
import { BiodataTab } from "./tabs/BiodataTab";
import { DokumenTab } from "./tabs/DokumenTab";
import { PrestasiTab } from "./tabs/PrestasiTab";
import { MonitoringTab } from "./tabs/MonitoringTab";

const TABS = [
  { key: "biodata", label: "Biodata" },
  { key: "dokumen", label: "Dokumen" },
  { key: "prestasi", label: "Prestasi" },
  { key: "monitoring", label: "Monitoring" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Module B — Atlet self-service profile. See specs/004-atlet/spec.md §5. */
export function MePage() {
  const location = useLocation();
  const [atlet, setAtlet] = useState<AtletDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>(
    location.pathname.endsWith("/prestasi") ? "prestasi" : "biodata",
  );

  // Sync the active tab when navigating between /me and /me/prestasi
  // (the component stays mounted, so the initial state alone is not enough).
  useEffect(() => {
    setTab(location.pathname.endsWith("/prestasi") ? "prestasi" : "biodata");
  }, [location.pathname]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    alamat: "",
    kecamatan: "",
    nomorHp: "",
    email: "",
    pendidikan: "",
    pekerjaan: "",
  });

  function openEdit() {
    if (!atlet) return;
    setEditForm({
      alamat: atlet.alamat ?? "",
      kecamatan: atlet.kecamatan ?? "",
      nomorHp: atlet.nomorHp ?? "",
      email: atlet.email ?? "",
      pendidikan: atlet.pendidikan ?? "",
      pekerjaan: atlet.pekerjaan ?? "",
    });
    setEditing(true);
  }

  // Revisi 2026-07-12: athletes self-input their own biodata.
  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch<AtletDetail>("/atlet/me", {
        alamat: editForm.alamat,
        kecamatan: editForm.kecamatan || undefined,
        nomorHp: editForm.nomorHp || undefined,
        email: editForm.email || undefined,
        pendidikan: editForm.pendidikan || undefined,
        pekerjaan: editForm.pekerjaan || undefined,
      });
      setAtlet(res.data);
      setEditing(false);
      toast.success("Data berhasil disimpan.");
    } catch {
      toast.error("Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  }

  function load() {
    api
      .get<AtletDetail>("/atlet/me")
      .then((res) => setAtlet(res.data))
      .catch(() => setError("Gagal memuat data profil."));
  }

  useEffect(load, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!atlet) return <p className="text-sm text-neutral-500">Memuat data...</p>;

  return (
    <div>
      <PageHeader
        title="Profil Saya"
        description={[atlet.nomorIndukAtlet, atlet.cabangOlahraga.nama].filter(Boolean).join(" · ")}
        actions={
          <Button variant="outline" onClick={openEdit}>
            <Pencil size={16} /> Ubah Data
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "biodata" && <BiodataTab atlet={atlet} />}
      {tab === "dokumen" && (
        <DokumenTab atletId={atlet.id} documents={atlet.documents ?? []} canManage onChange={load} />
      )}
      {tab === "prestasi" && <PrestasiTab atletId={atlet.id} canManage={false} />}
      {tab === "monitoring" && (
        <MonitoringTab atletId={atlet.id} canManage={false} currentCabangOlahragaId={atlet.cabangOlahragaId} />
      )}

      {editing && (
        <Modal title="Ubah Data Diri" onClose={() => setEditing(false)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Field label="Alamat" required htmlFor="me-alamat">
              <Input
                id="me-alamat"
                required
                value={editForm.alamat}
                onChange={(e) => setEditForm((f) => ({ ...f, alamat: e.target.value }))}
              />
            </Field>
            <Field label="Kecamatan" htmlFor="me-kecamatan">
              <Select
                id="me-kecamatan"
                value={editForm.kecamatan}
                onChange={(v) => setEditForm((f) => ({ ...f, kecamatan: v }))}
                options={[{ value: "", label: "Pilih kecamatan" }, ...BATAM_KECAMATAN.map((k) => ({ value: k, label: k }))]}
              />
            </Field>
            <Field label="Nomor HP" htmlFor="me-nomorHp">
              <Input
                id="me-nomorHp"
                pattern="\d+"
                title="Nomor HP harus berupa angka"
                value={editForm.nomorHp}
                onChange={(e) => setEditForm((f) => ({ ...f, nomorHp: e.target.value }))}
              />
            </Field>
            <Field label="Email" htmlFor="me-email">
              <Input
                id="me-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Pendidikan Terakhir" htmlFor="me-pendidikan">
              <Select
                id="me-pendidikan"
                value={editForm.pendidikan}
                onChange={(v) => setEditForm((f) => ({ ...f, pendidikan: v }))}
                options={[
                  { value: "", label: "Pilih jenjang" },
                  ...EDUCATION_LEVELS.map((e) => ({ value: e, label: e })),
                  ...(editForm.pendidikan && !EDUCATION_LEVELS.includes(editForm.pendidikan as (typeof EDUCATION_LEVELS)[number])
                    ? [{ value: editForm.pendidikan, label: editForm.pendidikan }]
                    : []),
                ]}
              />
            </Field>
            <Field label="Pekerjaan" htmlFor="me-pekerjaan">
              <Input
                id="me-pekerjaan"
                value={editForm.pekerjaan}
                onChange={(e) => setEditForm((f) => ({ ...f, pekerjaan: e.target.value }))}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Batal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
