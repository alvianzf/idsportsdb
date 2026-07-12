import { useEffect, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { EVENT_LEVEL_LABELS, EVENT_STATUS_LABELS } from "@inasportdb/shared-types";
import { Badge, Card } from "../../components/ui";
import { api } from "../../lib/api";
import { PublicShell } from "./PublicShell";
import { EVENT_STATUS_TONE, formatEventDate, type PublicEvent } from "./eventShared";

/** Public event calendar (spec 017). Shows the event data, no auth required. */
export function EventPublicPage() {
  const [events, setEvents] = useState<PublicEvent[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<PublicEvent[]>("/public/events")
      .then((res) => setEvents(res.data))
      .catch(() => setError(true));
  }, []);

  return (
    <PublicShell title="Kalender Event" description="Agenda kejuaraan dan kegiatan KONI Batam">
      {error && <Card className="text-sm text-danger">Gagal memuat data event.</Card>}
      {!error && events === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
      {events !== null && events.length === 0 && (
        <Card className="text-sm text-neutral-500">Belum ada event terjadwal.</Card>
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
                  <CalendarDays size={13} /> {formatEventDate(e)}
                </span>
                {e.lokasi && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} /> {e.lokasi}
                  </span>
                )}
              </div>
              {e.deskripsi && <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{e.deskripsi}</p>}
            </div>
            <Badge tone={EVENT_STATUS_TONE[e.status]} className="shrink-0 self-start sm:self-center">
              {EVENT_STATUS_LABELS[e.status]}
            </Badge>
          </Card>
        ))}
      </div>
    </PublicShell>
  );
}
