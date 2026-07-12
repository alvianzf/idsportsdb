import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  EVENT_LEVELS,
  EVENT_LEVEL_LABELS,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  UNSCOPED_ADMIN_ROLES,
  type EventLevel,
  type EventStatus,
} from "@inasportdb/shared-types";
import { Badge, Button, Card, Combobox, Field, Input, Modal, PageHeader, Select } from "../../components/ui";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";

interface EventRow {
  id: string;
  namaKejuaraan: string;
  tingkat: EventLevel;
  lokasi: string | null;
  deskripsi: string | null;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  status: EventStatus;
  cabangOlahraga: { id: string; nama: string } | null;
}

interface CaborOption {
  id: string;
  nama: string;
}

const STATUS_TONE: Record<EventStatus, "success" | "danger" | "warning" | "info"> = {
  SELESAI: "success",
  ON_TRACK: "info",
  DIBATALKAN: "danger",
  DIUNDUR: "warning",
};

interface EventForm {
  namaKejuaraan: string;
  tingkat: string;
  lokasi: string;
  deskripsi: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  cabangOlahragaId: string;
  status: string;
}

const emptyForm: EventForm = {
  namaKejuaraan: "",
  tingkat: "KOTA_KABUPATEN",
  lokasi: "",
  deskripsi: "",
  tanggalMulai: "",
  tanggalSelesai: "",
  cabangOlahragaId: "",
  status: "ON_TRACK",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

/** Kalender Event admin page. See specs/017-event-calendar/spec.md. */
export function EventListPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canWrite = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const canDelete = role === "SUPER_ADMIN_KONI";

  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setEvents(null);
    api
      .get<EventRow[]>("/events", { params: { status: status || undefined } })
      .then((res) => setEvents(res.data))
      .catch(() => setError(true));
  }

  useEffect(load, [status]);
  useEffect(() => {
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data)).catch(() => undefined);
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditing("new");
  }

  function openEdit(event: EventRow) {
    setForm({
      namaKejuaraan: event.namaKejuaraan,
      tingkat: event.tingkat,
      lokasi: event.lokasi ?? "",
      deskripsi: event.deskripsi ?? "",
      tanggalMulai: event.tanggalMulai.slice(0, 10),
      tanggalSelesai: event.tanggalSelesai ? event.tanggalSelesai.slice(0, 10) : "",
      cabangOlahragaId: event.cabangOlahraga?.id ?? "",
      status: event.status,
    });
    setEditing(event);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        namaKejuaraan: form.namaKejuaraan,
        tingkat: form.tingkat,
        lokasi: form.lokasi || undefined,
        deskripsi: form.deskripsi || undefined,
        tanggalMulai: form.tanggalMulai,
        tanggalSelesai: form.tanggalSelesai || undefined,
        cabangOlahragaId: form.cabangOlahragaId || undefined,
        status: form.status,
      };
      if (editing === "new") {
        await api.post("/events", payload);
        toast.success("Event berhasil ditambahkan.");
      } else if (editing) {
        await api.patch(`/events/${editing.id}`, payload);
        toast.success("Event berhasil diperbarui.");
      }
      setEditing(null);
      load();
    } catch {
      toast.error("Gagal menyimpan event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event: EventRow) {
    const confirmed = await confirmAction({
      text: `Hapus event "${event.namaKejuaraan}"?`,
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/events/${event.id}`);
      toast.success("Event berhasil dihapus.");
      load();
    } catch {
      toast.error("Gagal menghapus event.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Kalender Event"
        description="Agenda kejuaraan dan kegiatan KONI Batam"
        actions={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus size={16} /> Tambah Event
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Semua Status" },
            ...EVENT_STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_LABELS[s] })),
          ]}
          className="w-full sm:w-56"
        />
      </Card>

      {error && <Card className="text-sm text-danger">Gagal memuat data event.</Card>}
      {!error && events === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
      {events !== null && events.length === 0 && (
        <Card className="text-sm text-neutral-500">Belum ada event.</Card>
      )}

      <div className="space-y-3">
        {events?.map((e) => (
          <Card key={e.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-neutral-900">{e.namaKejuaraan}</p>
                <Badge tone="neutral">{EVENT_LEVEL_LABELS[e.tingkat]}</Badge>
                {e.cabangOlahraga && <Badge tone="info">{e.cabangOlahraga.nama}</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                  <CalendarDays size={13} />
                  {formatDate(e.tanggalMulai)}
                  {e.tanggalSelesai && e.tanggalSelesai !== e.tanggalMulai
                    ? ` – ${formatDate(e.tanggalSelesai)}`
                    : ""}
                </span>
                {e.lokasi && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} /> {e.lokasi}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
              <Badge tone={STATUS_TONE[e.status]}>{EVENT_STATUS_LABELS[e.status]}</Badge>
              {canWrite && (
                <Button variant="outline" onClick={() => openEdit(e)}>
                  <Pencil size={14} />
                </Button>
              )}
              {canDelete && (
                <Button variant="danger" onClick={() => handleDelete(e)}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Tambah Event" : "Ubah Event"} onClose={() => setEditing(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nama Kejuaraan" required htmlFor="ev-nama">
              <Input
                id="ev-nama"
                required
                value={form.namaKejuaraan}
                onChange={(e) => setForm((f) => ({ ...f, namaKejuaraan: e.target.value }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal Mulai" required htmlFor="ev-mulai">
                <Input
                  id="ev-mulai"
                  type="date"
                  required
                  value={form.tanggalMulai}
                  onChange={(e) => setForm((f) => ({ ...f, tanggalMulai: e.target.value }))}
                />
              </Field>
              <Field label="Tanggal Selesai" htmlFor="ev-selesai">
                <Input
                  id="ev-selesai"
                  type="date"
                  value={form.tanggalSelesai}
                  onChange={(e) => setForm((f) => ({ ...f, tanggalSelesai: e.target.value }))}
                />
              </Field>
              <Field label="Tingkat" required htmlFor="ev-tingkat">
                <Select
                  id="ev-tingkat"
                  required
                  value={form.tingkat}
                  onChange={(v) => setForm((f) => ({ ...f, tingkat: v }))}
                  options={EVENT_LEVELS.map((l) => ({ value: l, label: EVENT_LEVEL_LABELS[l] }))}
                />
              </Field>
              <Field label="Status" required htmlFor="ev-status">
                <Select
                  id="ev-status"
                  required
                  value={form.status}
                  onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  options={EVENT_STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_LABELS[s] }))}
                />
              </Field>
            </div>
            <Field label="Lokasi" htmlFor="ev-lokasi">
              <Input
                id="ev-lokasi"
                value={form.lokasi}
                onChange={(e) => setForm((f) => ({ ...f, lokasi: e.target.value }))}
              />
            </Field>
            <Field label="Cabang Olahraga (opsional)" htmlFor="ev-cabor">
              <Combobox
                id="ev-cabor"
                value={form.cabangOlahragaId}
                onChange={(v) => setForm((f) => ({ ...f, cabangOlahragaId: v }))}
                options={[{ value: "", label: "KONI (umum)" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
                placeholder="KONI (umum)"
              />
            </Field>
            <Field label="Deskripsi" htmlFor="ev-deskripsi">
              <Input
                id="ev-deskripsi"
                value={form.deskripsi}
                onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Batal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
