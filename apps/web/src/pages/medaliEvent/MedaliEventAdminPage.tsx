import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, X } from "lucide-react";
import { COMPETITION_LEVEL_CHOICES, COMPETITION_LEVEL_LABELS, type CompetitionLevel } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, Select, Combobox, DropZone, Modal, DataTable, type Column } from "../../components/ui";
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

interface EventCabor {
  id: string;
  cabangOlahraga: { id: string; nama: string };
}

interface MedaliEvent {
  id: string;
  nama: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: number;
  logoUrl: string | null;
  kontingen: Kontingen[];
  cabors: EventCabor[];
}

/** Admin "Event Medali" — at most one event exists at a time. See
 * specs/025-medali-event-adhoc/spec.md. */
export function MedaliEventAdminPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canDelete = role === "SUPER_ADMIN_KONI";
  const { cabors, reload: reloadCabors } = useCaborOptions();

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
        <EventManager event={event} cabors={cabors} onCaborsChange={reloadCabors} canDelete={canDelete} onChange={load} />
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
  onCaborsChange,
  canDelete,
  onChange,
}: {
  event: MedaliEvent;
  cabors: { id: string; nama: string }[];
  onCaborsChange: () => void;
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
  const [caborModalOpen, setCaborModalOpen] = useState(false);
  const [selectedCaborId, setSelectedCaborId] = useState("");
  const [newCaborNama, setNewCaborNama] = useState("");
  const [savingCabor, setSavingCabor] = useState(false);

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

  async function handleDeleteLogo() {
    if (!(await confirmAction({ text: "Hapus logo event?", danger: true, confirmText: "Hapus" }))) return;
    try {
      await api.delete(`/medali-event/${event.id}/logo`);
      toast.success("Logo berhasil dihapus.");
      onChange();
    } catch {
      toast.error("Gagal menghapus logo.");
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

  function closeCaborModal() {
    setCaborModalOpen(false);
    setSelectedCaborId("");
    setNewCaborNama("");
  }

  // Registers a cabor so it's filterable/visible on the public page before
  // any kontingen has a medal in it. "newCaborNama" covers exhibition sports
  // not already in the master cabor list — creates the cabor record first.
  async function handleAddCabor(e: FormEvent) {
    e.preventDefault();
    const trimmedNew = newCaborNama.trim();
    if (!trimmedNew && !selectedCaborId) return;
    setSavingCabor(true);
    try {
      let cabangOlahragaId = selectedCaborId;
      if (trimmedNew) {
        const res = await api.post<{ id: string }>("/cabor", { nama: trimmedNew });
        cabangOlahragaId = res.data.id;
        onCaborsChange();
      }
      await api.post(`/medali-event/${event.id}/cabor`, { cabangOlahragaId });
      closeCaborModal();
      onChange();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Gagal menambah cabor.");
    } finally {
      setSavingCabor(false);
    }
  }

  async function handleRemoveCabor(entry: EventCabor) {
    if (!(await confirmAction({ text: `Hapus "${entry.cabangOlahraga.nama}" dari daftar cabor event ini?`, danger: true, confirmText: "Hapus" })))
      return;
    try {
      await api.delete(`/medali-event/${event.id}/cabor/${entry.cabangOlahraga.id}`);
      onChange();
    } catch {
      toast.error("Gagal menghapus cabor.");
    }
  }

  const registeredCaborIds = new Set(event.cabors.map((c) => c.cabangOlahraga.id));
  const availableCaborsForEvent = cabors.filter((c) => !registeredCaborIds.has(c.id));

  const kontingenColumns: Column<Kontingen>[] = [
    {
      key: "nama",
      label: "Kabupaten/Kota",
      mobile: true,
      sortable: true,
      getValue: (k) => k.nama,
      render: (k) => <span className="font-medium text-neutral-900">{k.nama}</span>,
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
      render: (k) =>
        !k.isOwn && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteKontingen(k);
            }}
            className="text-neutral-400 hover:text-danger"
            aria-label={`Hapus ${k.nama}`}
          >
            <Trash2 size={14} />
          </button>
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
              <div className="relative shrink-0">
                <img src={resolveFileUrl(event.logoUrl)} alt="" className="h-16 w-16 rounded-lg border border-neutral-200 object-contain p-1" />
                <button
                  type="button"
                  onClick={handleDeleteLogo}
                  title="Hapus logo"
                  aria-label="Hapus logo"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X size={11} />
                </button>
              </div>
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
        <p className="mb-2 text-xs text-neutral-500">Klik baris untuk mengelola tally per cabor.</p>
        <DataTable
          columns={kontingenColumns}
          rows={event.kontingen}
          emptyMessage="Belum ada kontingen."
          expandContent={(k) => <InlineTally kontingen={k} cabors={cabors} onChange={onChange} />}
        />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Cabang Olahraga</h2>
          <Button variant="outline" onClick={() => setCaborModalOpen(true)}>
            <Plus size={16} /> Tambah
          </Button>
        </div>
        <p className="mb-2 text-xs text-neutral-500">
          Cabor yang dipertandingkan di event ini — tampil di filter "Per Cabor" publik dengan 0 medali sampai ada tally.
        </p>
        {event.cabors.length === 0 ? (
          <p className="text-sm text-neutral-500">Belum ada cabor terdaftar.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {event.cabors.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 py-1 pl-3 pr-1.5 text-sm text-neutral-700"
              >
                {c.cabangOlahraga.nama}
                <button
                  onClick={() => handleRemoveCabor(c)}
                  aria-label={`Hapus ${c.cabangOlahraga.nama}`}
                  className="rounded-full p-0.5 text-neutral-400 hover:text-danger"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
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

      {caborModalOpen && (
        <Modal title="Tambah Cabor" onClose={closeCaborModal}>
          <form onSubmit={handleAddCabor} className="space-y-4">
            <Field label="Cabor yang sudah terdaftar di sistem" htmlFor="existingCabor">
              <Combobox
                id="existingCabor"
                value={selectedCaborId}
                onChange={(v) => { setSelectedCaborId(v); setNewCaborNama(""); }}
                options={availableCaborsForEvent.map((c) => ({ value: c.id, label: c.nama }))}
                placeholder="Pilih cabor"
                disabled={!!newCaborNama.trim()}
              />
            </Field>
            <p className="text-center text-xs text-neutral-400">atau</p>
            <Field label="Tambahkan cabor baru (eksibisi)" htmlFor="newCaborNama">
              <Input
                id="newCaborNama"
                placeholder="mis. Futsal"
                value={newCaborNama}
                onChange={(e) => { setNewCaborNama(e.target.value); setSelectedCaborId(""); }}
              />
            </Field>
            <Button type="submit" disabled={savingCabor || (!selectedCaborId && !newCaborNama.trim())}>
              {savingCabor ? "Menyimpan..." : "Tambah"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

const numberCellClass = "w-16 rounded border border-neutral-200 px-2 py-1 text-sm";

/** Inline, editable per-cabor tally — expanded directly under a kontingen's
 * row (DataTable's `expandContent`), no modal. Existing rows save on blur;
 * a trailing row adds a new cabor directly into the table. */
function InlineTally({
  kontingen,
  cabors,
  onChange,
}: {
  kontingen: Kontingen;
  cabors: { id: string; nama: string }[];
  onChange: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, { gold: string; silver: string; bronze: string }>>({});
  useEffect(() => {
    setDrafts(
      Object.fromEntries(kontingen.tallies.map((t) => [t.id, { gold: String(t.gold), silver: String(t.silver), bronze: String(t.bronze) }])),
    );
  }, [kontingen.tallies]);

  const [newCaborId, setNewCaborId] = useState("");
  const [newGold, setNewGold] = useState("0");
  const [newSilver, setNewSilver] = useState("0");
  const [newBronze, setNewBronze] = useState("0");

  async function saveRow(t: Tally) {
    const d = drafts[t.id];
    if (!d) return;
    try {
      await api.put(`/medali-event/kontingen/${kontingen.id}/tally/${t.cabangOlahragaId}`, {
        gold: Number(d.gold) || 0,
        silver: Number(d.silver) || 0,
        bronze: Number(d.bronze) || 0,
      });
      onChange();
    } catch {
      toast.error("Gagal menyimpan tally.");
    }
  }

  async function removeRow(t: Tally) {
    if (!(await confirmAction({ text: `Hapus tally ${t.cabangOlahraga.nama} untuk "${kontingen.nama}"?`, danger: true, confirmText: "Hapus" }))) return;
    try {
      await api.put(`/medali-event/kontingen/${kontingen.id}/tally/${t.cabangOlahragaId}`, { gold: 0, silver: 0, bronze: 0 });
      onChange();
    } catch {
      toast.error("Gagal menghapus tally.");
    }
  }

  async function addRow(e: FormEvent) {
    e.preventDefault();
    if (!newCaborId) return;
    try {
      await api.put(`/medali-event/kontingen/${kontingen.id}/tally/${newCaborId}`, {
        gold: Number(newGold) || 0,
        silver: Number(newSilver) || 0,
        bronze: Number(newBronze) || 0,
      });
      setNewCaborId("");
      setNewGold("0");
      setNewSilver("0");
      setNewBronze("0");
      onChange();
    } catch {
      toast.error("Gagal menambah tally.");
    }
  }

  const usedCaborIds = new Set(kontingen.tallies.map((t) => t.cabangOlahragaId));
  const availableCabors = cabors.filter((c) => !usedCaborIds.has(c.id));

  return (
    // Stop the click from bubbling to the kontingen row (which would toggle it closed).
    <div onClick={(e) => e.stopPropagation()} className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-3">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-400">
            <th className="pb-2 pr-3 font-medium">Cabor</th>
            <th className="pb-2 pr-3 font-medium text-gold">Emas</th>
            <th className="pb-2 pr-3 font-medium text-silver">Perak</th>
            <th className="pb-2 pr-3 font-medium text-bronze">Perunggu</th>
            <th className="w-8 pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {kontingen.tallies.map((t) => (
            <tr key={t.id}>
              <td className="py-2 pr-3 text-neutral-700">{t.cabangOlahraga.nama}</td>
              <td className="py-2 pr-3">
                <input
                  type="number"
                  min={0}
                  className={numberCellClass}
                  value={drafts[t.id]?.gold ?? t.gold}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: { ...d[t.id], gold: e.target.value } }))}
                  onBlur={() => saveRow(t)}
                  aria-label={`Emas ${t.cabangOlahraga.nama}`}
                />
              </td>
              <td className="py-2 pr-3">
                <input
                  type="number"
                  min={0}
                  className={numberCellClass}
                  value={drafts[t.id]?.silver ?? t.silver}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: { ...d[t.id], silver: e.target.value } }))}
                  onBlur={() => saveRow(t)}
                  aria-label={`Perak ${t.cabangOlahraga.nama}`}
                />
              </td>
              <td className="py-2 pr-3">
                <input
                  type="number"
                  min={0}
                  className={numberCellClass}
                  value={drafts[t.id]?.bronze ?? t.bronze}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: { ...d[t.id], bronze: e.target.value } }))}
                  onBlur={() => saveRow(t)}
                  aria-label={`Perunggu ${t.cabangOlahraga.nama}`}
                />
              </td>
              <td className="py-2">
                <button onClick={() => removeRow(t)} className="text-neutral-400 hover:text-danger" aria-label={`Hapus ${t.cabangOlahraga.nama}`}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-2 pr-3">
              <Combobox
                value={newCaborId}
                onChange={setNewCaborId}
                options={availableCabors.map((c) => ({ value: c.id, label: c.nama }))}
                placeholder="+ Tambah cabor"
              />
            </td>
            <td className="py-2 pr-3">
              <input type="number" min={0} className={numberCellClass} value={newGold} onChange={(e) => setNewGold(e.target.value)} aria-label="Emas cabor baru" />
            </td>
            <td className="py-2 pr-3">
              <input type="number" min={0} className={numberCellClass} value={newSilver} onChange={(e) => setNewSilver(e.target.value)} aria-label="Perak cabor baru" />
            </td>
            <td className="py-2 pr-3">
              <input type="number" min={0} className={numberCellClass} value={newBronze} onChange={(e) => setNewBronze(e.target.value)} aria-label="Perunggu cabor baru" />
            </td>
            <td className="py-2">
              <button onClick={addRow} disabled={!newCaborId} className="text-primary hover:text-primary-700 disabled:opacity-30" aria-label="Tambah cabor">
                <Plus size={16} />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
