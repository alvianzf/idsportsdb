import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card } from "../../components/ui";
import { PublicShell } from "./PublicShell";
import { type PublicEvent } from "./eventShared";
import { EMPTY_FILTERS, filterEvents, type EventFilters } from "../event/calendarUtils";
import {
  EventCards,
  EventFilterBar,
  EventGantt,
  EventMonthCalendar,
  EventTable,
  type EventView,
} from "../event/EventViews";

/** Public event calendar (spec 017 §4): Kalender/Card/Tabel/Gantt views with
 * search & filters. Read-only — no drag/create/edit, no badge pills. */
export function EventPublicPage() {
  const [events, setEvents] = useState<PublicEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<EventView>("kalender");
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS);

  useEffect(() => {
    api
      .get<PublicEvent[]>("/public/events")
      .then((res) => setEvents(res.data))
      .catch(() => setError(true));
  }, []);

  const filtered = filterEvents(events ?? [], filters);

  return (
    <PublicShell title="Kalender Event" description="Agenda kejuaraan dan kegiatan KONI Batam">
      {error && <Card className="text-sm text-danger">Gagal memuat data event.</Card>}
      {!error && events === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
      {events !== null && (
        <>
          <EventFilterBar view={view} onViewChange={setView} filters={filters} onFiltersChange={setFilters} events={events} />
          {view === "kalender" && <EventMonthCalendar events={filtered} jumpTo={filters.date || undefined} />}
          {view === "card" && <EventCards events={filtered} plain />}
          {view === "table" && <EventTable events={filtered} />}
          {view === "gantt" && <EventGantt events={filtered} />}
        </>
      )}
    </PublicShell>
  );
}
