import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { COMPETITION_LEVEL_CHOICES, COMPETITION_LEVEL_LABELS, type CompetitionLevel } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Select, Combobox, DropZone, Badge, Modal, DataTable, type Column } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";
import { useCaborOptions } from "../../hooks/useCaborOptions";

interface Tally {
  id: string;
  cabangOlahragaId: string;
  cabangOlahraga: { id: string; nama: string };
  gold: number;
  silver: number;
  bronze: number;
}

interface Kontingen {
  id: string;
  nama: string;
  isOwn: boolean;
  tallies: Tally[];
}

interface MedaliEvent {
  id: string;
  nama: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: number;
  logoUrl: string | null;
  kontingen: Kontingen[];
}

/** Admin "Event Medali" — at most one event exists at a time. See
 * specs/025-medali-event-adhoc/spec.md. */
export function MedaliEventAdminPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canDelete = role === "SUPER_ADMIN_KONI";
  const { cabors } = useCaborOptions();

  const [event, setEvent] = useState<MedaliEvent | null | undefined>(undefined);

  function load() {
    api.get<MedaliEvent | null>("/medali-event").then((res) => setEvent(res.data));
  }
  useEffect(load, []);

  if (event === undefined) return <Card className="text-sm text-neutral-500">Memuat data...</Card>;

  return (
    <div>
      <PageHeader title="Event Medali" description="Tally medali ad-hoc lintas kabupaten/kota (mis. PORPROV)." />
      {!event ? (
        <CreateEventForm onCreated={load} />
      ) : (
        <EventManager event={event} cabors={cabors} canDelete={canDelete} onChange={load} />
      )}
    </div>
  );
}

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [nama, setNama] = useState("");
  const [tingkat, setTingkat] = useState<CompetitionLevel | "">("");
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/medali-event", { nama, tingkatKejuaraan: tingkat, tahun: Number(tahun) });
      toast.success("Event berhasil dibuat.");
      onCreated();
    } catch {
      toast.error("Gagal membuat event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <p className="mb-4 text-sm text-neutral-500">Belum ada event aktif. Buat satu untuk mulai mencatat tally.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama Event" required htmlFor="nama">
          <Input id="nama" required placeholder="PORPROV KEPRI VI" value={nama} onChange={(e) => setNama(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tingkat Kejuaraan" required htmlFor="tingkat">
            <Select
              id="tingkat"
              required
              value={tingkat}
              onChange={(v) => setTingkat(v as CompetitionLevel)}
              options={[
                { value: "", label: "Pilih tingkat" },
                ...COMPETITION_LEVEL_CHOICES.map((l) => ({ value: l, label: COMPETITION_LEVEL_LABELS[l] })),
              ]}
            />
          </Field>
          <Field label="Tahun" required htmlFor="tahun">
            <Input id="tahun" type="number" required value={tahun} onChange={(e) => setTahun(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Buat Event"}
        </Button>
      </form>
    </Card>
  );
}

function EventManager({
  event,
  cabors,
  canDelete,
  onChange,
}: {
  event: MedaliEvent;
  cabors: { id: string; nama: string }[];
  canDelete: boolean;
  onChange: () => void;
}) {
  const [nama, setNama] = useState(event.nama);
  const [tingkat, setTingkat] = useState<CompetitionLevel>(event.tingkatKejuaraan);
  const [tahun, setTahun] = useState(String(event.tahun));
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [kontingenNama, setKontingenNama] = useState("");
  const [editing, setEditing] = useState<Kontingen | null>(null);

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/medali-event/${event.id}`, { nama, tingkatKejuaraan: tingkat, tahun: Number(tahun) });
      toast.success("Event berhasil diubah.");
      onChange();
    } catch {
      toast.error("Gagal mengubah event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadLogo() {
    if (!logoFile) return;
    const fd = new FormData();
    fd.append("file", logoFile);
    try {
      await api.post(`/medali-event/${event.id}/logo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Logo berhasil diunggah.");
      setLogoFile(null);
      onChange();
    } catch {
      toast.error("Gagal mengunggah logo.");
    }
  }

  async function handleDeleteEvent() {
    if (!(await confirmAction({ text: `Hapus event "${event.nama}"? Semua data kontingen & tally ikut terhapus.`, danger: true, confirmText: "Hapus" })))
      return;
    try {
      await api.delete(`/medali-event/${event.id}`);
      toast.success("Event berhasil dihapus.");
      onChange();
    } catch {
      toast.error("Gagal menghapus event.");
    }
  }

  async function handleAddKontingen(e: FormEvent) {
    e.preventDefault();
    if (!kontingenNama.trim()) return;
    try {
      await api.post(`/medali-event/${event.id}/kontingen`, { nama: kontingenNama.trim() });
      setKontingenNama("");
      setAddModalOpen(false);
      onChange();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Gagal menambah kontingen.");
    }
  }

  async function handleDeleteKontingen(k: Kontingen) {
    if (!(await confirmAction({ text: `Hapus kontingen "${k.nama}"?`, danger: true, confirmText: "Hapus" }))) return;
    try {
      await api.delete(`/medali-event/kontingen/${k.id}`);
      onChange();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Gagal menghapus kontingen.");
    }
  }

  // Keep an open tally-editor modal in sync with fresh data after each save.
  useEffect(() => {
    if (!editing) return;
    const fresh = event.kontingen.find((k) => k.id === editing.id);
    setEditing(fresh ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.kontingen]);

  const kontingenColumns: Column<Kontingen>[] = [
    {
      key: "nama",
      label: "Kabupaten/Kota",
      mobile: true,
      sortable: true,
      getValue: (k) => k.nama,
      render: (k) => (
        <span className="flex items-center gap-2 font-medium text-neutral-900">
          {k.nama}
          {k.isOwn && <Badge tone="info">Kontingen Kita</Badge>}
        </span>
      ),
    },
    { key: "gold", label: "Emas", sortable: true, getValue: (k) => k.tallies.reduce((s, t) => s + t.gold, 0), render: (k) => <span className="text-gold">{k.tallies.reduce((s, t) => s + t.gold, 0)}</span> },
    { key: "silver", label: "Perak", sortable: true, getValue: (k) => k.tallies.reduce((s, t) => s + t.silver, 0), render: (k) => <span className="text-silver">{k.tallies.reduce((s, t) => s + t.silver, 0)}</span> },
    { key: "bronze", label: "Perunggu", sortable: true, getValue: (k) => k.tallies.reduce((s, t) => s + t.bronze, 0), render: (k) => <span className="text-bronze">{k.tallies.reduce((s, t) => s + t.bronze, 0)}</span> },
    {
      key: "total",
      label: "Total",
      mobile: true,
      sortable: true,
      getValue: (k) => k.tallies.reduce((s, t) => s + t.gold + t.silver + t.bronze, 0),
      render: (k) => <span className="font-semibold text-neutral-900">{k.tallies.reduce((s, t) => s + t.gold + t.silver + t.bronze, 0)}</span>,
    },
    {
      key: "aksi",
      label: "Aksi",
      mobile: true,
      render: (k) => (
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(k)} className="text-primary hover:underline" aria-label={`Kelola tally ${k.nama}`}>
            <Pencil size={14} />
          </button>
          {!k.isOwn && (
            <button onClick={() => handleDeleteKontingen(k)} className="text-neutral-400 hover:text-danger" aria-label={`Hapus ${k.nama}`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Detail Event</h2>
        <form onSubmit={handleSaveDetails} className="space-y-4">
          <div className="flex items-start gap-4">
            {event.logoUrl && (
              <img src={resolveFileUrl(event.logoUrl)} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-neutral-200 object-contain p-1" />
            )}
            <div className="flex-1 space-y-3">
              <Field label="Nama Event" required htmlFor="nama">
                <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tingkat Kejuaraan" required htmlFor="tingkat">
                  <Select
                    id="tingkat"
                    required
                    value={tingkat}
                    onChange={(v) => setTingkat(v as CompetitionLevel)}
                    options={COMPETITION_LEVEL_CHOICES.map((l) => ({ value: l, label: COMPETITION_LEVEL_LABELS[l] }))}
                  />
                </Field>
                <Field label="Tahun" required htmlFor="tahun">
                  <Input id="tahun" type="number" required value={tahun} onChange={(e) => setTahun(e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
          <Field label="Logo (opsional)">
            <div className="flex items-center gap-2">
              <DropZone value={logoFile} onChange={setLogoFile} sublabel="PNG, JPG, WEBP — maks. 5 MB" />
              {logoFile && (
                <Button type="button" variant="outline" onClick={handleUploadLogo}>
                  Unggah
                </Button>
              )}
            </div>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
            {canDelete && (
              <Button type="button" variant="outline" onClick={handleDeleteEvent}>
                <Trash2 size={16} /> Hapus Event
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Kabupaten &amp; Kota</h2>
          <Button variant="outline" onClick={() => setAddModalOpen(true)}>
            <Plus size={16} /> Tambah
          </Button>
        </div>
        <DataTable columns={kontingenColumns} rows={event.kontingen} emptyMessage="Belum ada kontingen." />
      </Card>

      {addModalOpen && (
        <Modal title="Tambah Kontingen" onClose={() => setAddModalOpen(false)}>
          <form onSubmit={handleAddKontingen} className="space-y-4">
            <Field label="Nama Kabupaten/Kota" required htmlFor="kontingenNama">
              <Input id="kontingenNama" required placeholder="mis. Bintan" value={kontingenNama} onChange={(e) => setKontingenNama(e.target.value)} />
            </Field>
            <Button type="submit">Tambah</Button>
          </form>
        </Modal>
      )}

      {editing && <TallyModal kontingen={editing} cabors={cabors} onClose={() => setEditing(null)} onChange={onChange} />}
    </div>
  );
}

function TallyModal({
  kontingen,
  cabors,
  onClose,
  onChange,
}: {
  kontingen: Kontingen;
  cabors: { id: string; nama: string }[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [caborId, setCaborId] = useState("");
  const [gold, setGold] = useState("0");
  const [silver, setSilver] = useState("0");
  const [bronze, setBronze] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleAddTally(e: FormEvent) {
    e.preventDefault();
    if (!caborId) return;
    setSaving(true);
    try {
      await api.put(`/medali-event/kontingen/${kontingen.id}/tally/${caborId}`, {
        gold: Number(gold),
        silver: Number(silver),
        bronze: Number(bronze),
      });
      setCaborId("");
      setGold("0");
      setSilver("0");
      setBronze("0");
      onChange();
    } catch {
      toast.error("Gagal menyimpan tally.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveTally(cabangOlahragaId: string) {
    try {
      await api.put(`/medali-event/kontingen/${kontingen.id}/tally/${cabangOlahragaId}`, { gold: 0, silver: 0, bronze: 0 });
      onChange();
    } catch {
      toast.error("Gagal menghapus tally.");
    }
  }

  const tallyColumns: Column<Tally>[] = [
    { key: "cabor", label: "Cabor", mobile: true, render: (t) => <span className="text-neutral-700">{t.cabangOlahraga.nama}</span> },
    { key: "gold", label: "Emas", mobile: true, render: (t) => <span className="text-gold">{t.gold}</span> },
    { key: "silver", label: "Perak", render: (t) => <span className="text-silver">{t.silver}</span> },
    { key: "bronze", label: "Perunggu", render: (t) => <span className="text-bronze">{t.bronze}</span> },
    {
      key: "aksi",
      label: "Aksi",
      mobile: true,
      render: (t) => (
        <button onClick={() => handleRemoveTally(t.cabangOlahragaId)} className="text-neutral-400 hover:text-danger" aria-label={`Hapus tally ${t.cabangOlahraga.nama}`}>
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <Modal title={`Tally — ${kontingen.nama}`} onClose={onClose}>
      <DataTable
        columns={tallyColumns}
        rows={kontingen.tallies.map((t) => ({ ...t, id: t.id }))}
        emptyMessage="Belum ada tally untuk kontingen ini."
      />
      <form onSubmit={handleAddTally} className="mt-4 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
        <div className="min-w-[180px] flex-1">
          <Field label="Cabor" htmlFor="cabor">
            <Combobox id="cabor" value={caborId} onChange={setCaborId} options={cabors.map((c) => ({ value: c.id, label: c.nama }))} placeholder="Pilih cabor" />
          </Field>
        </div>
        <Field label="Emas" htmlFor="gold">
          <Input id="gold" type="number" min={0} value={gold} onChange={(e) => setGold(e.target.value)} className="w-16" />
        </Field>
        <Field label="Perak" htmlFor="silver">
          <Input id="silver" type="number" min={0} value={silver} onChange={(e) => setSilver(e.target.value)} className="w-16" />
        </Field>
        <Field label="Perunggu" htmlFor="bronze">
          <Input id="bronze" type="number" min={0} value={bronze} onChange={(e) => setBronze(e.target.value)} className="w-16" />
        </Field>
        <Button type="submit" variant="outline" disabled={saving || !caborId}>
          Simpan
        </Button>
      </form>
    </Modal>
  );
}
