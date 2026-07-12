import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  EVENT_LEVELS,
  EVENT_LEVEL_LABELS,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  UNSCOPED_ADMIN_ROLES,
} from "@inasportdb/shared-types";
import { Button, Card, Combobox, Field, Input, Modal, PageHeader, Select } from "../../components/ui";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";
import type { PublicEvent } from "../public/eventShared";
import { addDays, diffDays, eventEnd, eventStart, EMPTY_FILTERS, filterEvents, type EventFilters } from "./calendarUtils";
import { EventCards, EventFilterBar, EventGantt, EventMonthCalendar, EventTable, type EventView } from "./EventViews";

interface CaborOption {
  id: string;
  nama: string;
}

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

/** Kalender Event admin page — Google-Calendar-like (spec 017 §4): four views,
 * search/filter, drag-and-drop reschedule, click-a-day to create. */
export function EventListPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canWrite = role && UNSCOPED_ADMIN_ROLES.includes(role);
  const canDelete = role === "SUPER_ADMIN_KONI";

  const [events, setEvents] = useState<PublicEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<EventView>("kalender");
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [editing, setEditing] = useState<PublicEvent | "new" | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get<PublicEvent[]>("/events")
      .then((res) => setEvents(res.data))
      .catch(() => setError(true));
  }

  useEffect(load, []);
  useEffect(() => {
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data)).catch(() => undefined);
  }, []);

  function openCreate(prefillDate?: string) {
    setForm({ ...emptyForm, tanggalMulai: prefillDate ?? "" });
    setEditing("new");
  }

  function openEdit(event: PublicEvent) {
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

  // Spec 017 §4: drop on a day = new start date, duration preserved.
  async function handleEventDrop(event: PublicEvent, newStart: string) {
    if (!canWrite) return;
    const duration = diffDays(eventStart(event), eventEnd(event));
    const payload: Record<string, string> = { tanggalMulai: newStart };
    if (event.tanggalSelesai) payload.tanggalSelesai = addDays(newStart, duration);
    try {
      await api.patch(`/events/${event.id}`, payload);
      toast.success("Jadwal event dipindahkan.");
      load();
    } catch {
      toast.error("Gagal memindahkan jadwal.");
    }
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

  async function handleDelete(event: PublicEvent) {
    const confirmed = await confirmAction({
      text: `Hapus event "${event.namaKejuaraan}"?`,
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/events/${event.id}`);
      toast.success("Event berhasil dihapus.");
      setEditing(null);
      load();
    } catch {
      toast.error("Gagal menghapus event.");
    }
  }

  const filtered = filterEvents(events ?? [], filters);
  const onEventClick = canWrite ? openEdit : undefined;

  return (
    <div>
      <PageHeader
        title="Kalender Event"
        description="Agenda kejuaraan dan kegiatan KONI Batam"
        actions={
          canWrite ? (
            <Button onClick={() => openCreate()}>
              <Plus size={16} /> Tambah Event
            </Button>
          ) : undefined
        }
      />

      {error && <Card className="text-sm text-danger">Gagal memuat data event.</Card>}
      {!error && events === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
      {events !== null && (
        <>
          <EventFilterBar view={view} onViewChange={setView} filters={filters} onFiltersChange={setFilters} events={events} />
          {view === "kalender" && (
            <EventMonthCalendar
              events={filtered}
              canEdit={!!canWrite}
              jumpTo={filters.date || undefined}
              onDayClick={canWrite ? (day) => openCreate(day) : undefined}
              onEventClick={onEventClick}
              onEventDrop={canWrite ? handleEventDrop : undefined}
            />
          )}
          {view === "card" && (
            <EventCards
              events={filtered}
              onEventClick={onEventClick}
              actions={
                canWrite
                  ? (e) => (
                      <Button
                        variant="outline"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEdit(e);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                    )
                  : undefined
              }
            />
          )}
          {view === "table" && <EventTable events={filtered} onEventClick={onEventClick} />}
          {view === "gantt" && <EventGantt events={filtered} onEventClick={onEventClick} />}
        </>
      )}

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
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Batal
              </Button>
              {editing !== "new" && canDelete && (
                <Button type="button" variant="danger" className="ml-auto" onClick={() => handleDelete(editing)}>
                  <Trash2 size={14} /> Hapus
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
