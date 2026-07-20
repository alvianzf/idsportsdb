import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { UNSCOPED_ADMIN_ROLES } from "@inasportdb/shared-types";
import { Button, Card, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";
import type { PublicEvent } from "../public/eventShared";
import { addDays, diffDays, eventEnd, eventStart, EMPTY_FILTERS, filterEvents, searchJumpDate, type EventFilters } from "./calendarUtils";
import { EventFormModal } from "./EventFormModal";
import { EventCards, EventFilterBar, EventGantt, EventMonthCalendar, EventTable, type EventView } from "./EventViews";

interface CaborOption {
  id: string;
  nama: string;
}

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
  // Start date pre-filled when a create is opened by clicking a calendar day.
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);

  function load() {
    setError(false);
    api
      .get<PublicEvent[]>("/events")
      .then((res) => setEvents(res.data))
      .catch(() => setError(true));
  }

  useEffect(load, []);
  useEffect(() => {
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data)).catch(() => undefined);
  }, []);

  function openCreate(date?: string) {
    setPrefillDate(date);
    setEditing("new");
  }

  function openEdit(event: PublicEvent) {
    setPrefillDate(undefined);
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
              jumpTo={filters.date || searchJumpDate(filtered, filters.search)}
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
        <EventFormModal
          event={editing}
          prefillDate={prefillDate}
          cabors={cabors}
          onDelete={canDelete ? handleDelete : undefined}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
