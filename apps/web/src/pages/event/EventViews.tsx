import { useEffect, useMemo, useState, type DragEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, MapPin, Rows3, Search, Table2 } from "lucide-react";
import {
  EVENT_LEVELS,
  EVENT_LEVEL_LABELS,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  type EventStatus,
} from "@inasportdb/shared-types";
import { Badge, Card, DataTable, Input, Select, type Column } from "../../components/ui";
import { EVENT_STATUS_TONE, formatEventDate, type PublicEvent } from "../public/eventShared";
import {
  addDays,
  diffDays,
  eventEnd,
  eventStart,
  firstOfMonth,
  monthLabel,
  monthWeeks,
  shiftMonth,
  ymd,
  type EventFilters,
} from "./calendarUtils";

export type EventView = "kalender" | "card" | "table" | "gantt";

const STATUS_BG: Record<EventStatus, string> = {
  ON_TRACK: "bg-info",
  SELESAI: "bg-success",
  DIBATALKAN: "bg-danger",
  DIUNDUR: "bg-warning",
};

/** Event status is always a badge (client note 2026-07-12: allowed on the
 * kalender event even though public pages otherwise avoid badge pills). */
function StatusLabel({ status }: { status: EventStatus }) {
  return <Badge tone={EVENT_STATUS_TONE[status]}>{EVENT_STATUS_LABELS[status]}</Badge>;
}

// ---------------------------------------------------------------------------
// Filter bar + view switcher
// ---------------------------------------------------------------------------

export function EventFilterBar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  events,
}: {
  view: EventView;
  onViewChange: (v: EventView) => void;
  filters: EventFilters;
  onFiltersChange: (f: EventFilters) => void;
  events: PublicEvent[];
}) {
  const caborOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) if (e.cabangOlahraga) map.set(e.cabangOlahraga.id, e.cabangOlahraga.nama);
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  const set = (patch: Partial<EventFilters>) => onFiltersChange({ ...filters, ...patch });

  const VIEWS: { key: EventView; label: string; icon: typeof CalendarDays }[] = [
    { key: "kalender", label: "Kalender", icon: CalendarDays },
    { key: "card", label: "Card", icon: LayoutGrid },
    { key: "table", label: "Tabel", icon: Table2 },
    { key: "gantt", label: "Gantt", icon: Rows3 },
  ];

  return (
    <Card className="mb-4 space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Cari nama kejuaraan atau cabor..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Input
          type="date"
          value={filters.date}
          onChange={(e) => set({ date: e.target.value })}
          className="lg:w-44"
          title="Filter/lompat ke tanggal"
        />
        <Select
          value={filters.status}
          onChange={(v) => set({ status: v })}
          options={[{ value: "", label: "Semua Status" }, ...EVENT_STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_LABELS[s] }))]}
          className="lg:w-44"
        />
        <Select
          value={filters.tingkat}
          onChange={(v) => set({ tingkat: v })}
          options={[{ value: "", label: "Semua Tingkat" }, ...EVENT_LEVELS.map((l) => ({ value: l, label: EVENT_LEVEL_LABELS[l] }))]}
          className="lg:w-48"
        />
        <Select
          value={filters.cabor}
          onChange={(v) => set({ cabor: v })}
          options={[{ value: "", label: "Semua Cabor" }, ...caborOptions]}
          className="lg:w-48"
        />
      </div>
      <div className="flex flex-wrap gap-1 border-t border-neutral-100 pt-3">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === key ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Kalender (month grid, Google-Calendar-like)
// ---------------------------------------------------------------------------

interface Segment {
  event: PublicEvent;
  col: number; // 1-7
  span: number;
  lane: number;
  isStart: boolean;
}

function weekSegments(events: PublicEvent[], week: string[]): Segment[] {
  const weekStart = week[0];
  const weekEnd = week[6];
  const overlapping = events
    .filter((e) => eventStart(e) <= weekEnd && eventEnd(e) >= weekStart)
    .sort((a, b) => eventStart(a).localeCompare(eventStart(b)) || eventEnd(b).localeCompare(eventEnd(a)));

  const laneEnds: number[] = [];
  const segments: Segment[] = [];
  for (const event of overlapping) {
    const startIdx = Math.max(0, diffDays(weekStart, eventStart(event)));
    const endIdx = Math.min(6, diffDays(weekStart, eventEnd(event)));
    let lane = laneEnds.findIndex((end) => end < startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endIdx);
    } else {
      laneEnds[lane] = endIdx;
    }
    segments.push({
      event,
      col: startIdx + 1,
      span: endIdx - startIdx + 1,
      lane,
      isStart: eventStart(event) >= weekStart,
    });
  }
  return segments;
}

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function EventMonthCalendar({
  events,
  canEdit = false,
  onDayClick,
  onEventClick,
  onEventDrop,
  jumpTo,
}: {
  events: PublicEvent[];
  canEdit?: boolean;
  onDayClick?: (day: string) => void;
  onEventClick?: (event: PublicEvent) => void;
  onEventDrop?: (event: PublicEvent, newStart: string) => void;
  jumpTo?: string;
}) {
  const today = ymd(new Date());
  const [month, setMonth] = useState(firstOfMonth(today));

  // Date filter/search jumps the calendar to that month (spec 017 §4).
  useEffect(() => {
    if (jumpTo) setMonth(firstOfMonth(jumpTo));
  }, [jumpTo]);

  const weeks = useMemo(() => monthWeeks(month), [month]);

  function handleDrop(day: string, e: DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/koni-event");
    const event = events.find((ev) => ev.id === id);
    if (event && onEventDrop) onEventDrop(event, day);
  }

  return (
    <Card className="overflow-x-auto p-0">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-bold capitalize text-neutral-900">{monthLabel(month)}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Bulan sebelumnya">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setMonth(firstOfMonth(today))} className="rounded-md px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-100">
            Hari ini
          </button>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Bulan berikutnya">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-neutral-100 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        {weeks.map((week) => {
          const segments = weekSegments(events, week);
          const laneCount = Math.max(1, ...segments.map((s) => s.lane + 1));
          return (
            <div
              key={week[0]}
              className="grid border-b border-neutral-100 last:border-b-0"
              style={{
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gridTemplateRows: `1.75rem repeat(${laneCount}, 1.625rem) 0.375rem`,
              }}
            >
              {week.map((day, i) => {
                const inMonth = day.slice(0, 7) === month.slice(0, 7);
                const isToday = day === today;
                return (
                  <div
                    key={day}
                    onDragOver={canEdit ? (e) => e.preventDefault() : undefined}
                    onDrop={canEdit ? (e) => handleDrop(day, e) : undefined}
                    onClick={onDayClick ? () => onDayClick(day) : undefined}
                    className={`border-r border-neutral-100 last:border-r-0 ${inMonth ? "" : "bg-neutral-50/70"} ${
                      onDayClick ? "cursor-pointer hover:bg-primary-50/40" : ""
                    }`}
                    style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                  >
                    <div className="flex justify-end p-1.5">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                          isToday ? "bg-primary text-white" : inMonth ? "text-neutral-700" : "text-neutral-300"
                        }`}
                      >
                        {Number(day.slice(8, 10))}
                      </span>
                    </div>
                  </div>
                );
              })}

              {segments.map((s) => (
                <button
                  key={`${s.event.id}-${week[0]}`}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData("text/koni-event", s.event.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(s.event);
                  }}
                  title={`${s.event.namaKejuaraan} · ${formatEventDate(s.event)} · ${EVENT_STATUS_LABELS[s.event.status]}`}
                  className={`z-10 mx-0.5 truncate rounded px-1.5 text-left text-[11px] font-medium leading-6 text-white shadow-sm transition hover:opacity-85 ${
                    STATUS_BG[s.event.status]
                  } ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${s.isStart ? "" : "rounded-l-none"}`}
                  style={{ gridColumn: `${s.col} / span ${s.span}`, gridRow: s.lane + 2 }}
                >
                  {s.event.namaKejuaraan}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-4 py-2.5 text-[11px] text-neutral-500">
        {EVENT_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_BG[s]}`} /> {EVENT_STATUS_LABELS[s]}
          </span>
        ))}
        {canEdit && <span className="ml-auto italic">Seret event untuk mengubah jadwal · klik tanggal untuk menambah</span>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card view
// ---------------------------------------------------------------------------

export function EventCards({
  events,
  onEventClick,
  actions,
  plain,
}: {
  events: PublicEvent[];
  onEventClick?: (event: PublicEvent) => void;
  actions?: (event: PublicEvent) => React.ReactNode;
  plain?: boolean;
}) {
  if (events.length === 0) return <Card className="text-sm text-neutral-500">Tidak ada event yang cocok.</Card>;
  return (
    <div className="space-y-3">
      {events.map((e) => (
        <Card
          key={e.id}
          className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${onEventClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}
          onClick={onEventClick ? () => onEventClick(e) : undefined}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-neutral-900">{e.namaKejuaraan}</p>
              {plain ? (
                <span className="text-xs text-neutral-500">
                  {EVENT_LEVEL_LABELS[e.tingkat]}
                  {e.cabangOlahraga ? ` · ${e.cabangOlahraga.nama}` : ""}
                </span>
              ) : (
                <>
                  <Badge tone="neutral">{EVENT_LEVEL_LABELS[e.tingkat]}</Badge>
                  {e.cabangOlahraga && <Badge tone="info">{e.cabangOlahraga.nama}</Badge>}
                </>
              )}
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
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <StatusLabel status={e.status} />
            {actions?.(e)}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table view (sortable; mobile collapses behind a chevron, showing
// Tanggal + Nama — via the shared DataTable)
// ---------------------------------------------------------------------------

export function EventTable({ events, onEventClick }: { events: PublicEvent[]; onEventClick?: (event: PublicEvent) => void }) {
  const columns: Column<PublicEvent>[] = [
    {
      key: "tanggal",
      label: "Tanggal",
      mobile: true,
      sortable: true,
      getValue: (e) => eventStart(e),
      render: (e) => <span className="whitespace-nowrap text-neutral-600">{formatEventDate(e)}</span>,
    },
    {
      key: "nama",
      label: "Nama Kejuaraan",
      mobile: true,
      sortable: true,
      getValue: (e) => e.namaKejuaraan,
      render: (e) =>
        onEventClick ? (
          <button onClick={() => onEventClick(e)} className="text-left font-medium text-primary hover:underline">
            {e.namaKejuaraan}
          </button>
        ) : (
          <span className="font-medium text-neutral-900">{e.namaKejuaraan}</span>
        ),
    },
    {
      key: "tingkat",
      label: "Tingkat",
      sortable: true,
      getValue: (e) => e.tingkat,
      render: (e) => <span className="text-neutral-600">{EVENT_LEVEL_LABELS[e.tingkat]}</span>,
    },
    { key: "lokasi", label: "Lokasi", render: (e) => <span className="text-neutral-600">{e.lokasi ?? "-"}</span> },
    { key: "cabor", label: "Cabor", render: (e) => <span className="text-neutral-600">{e.cabangOlahraga?.nama ?? "-"}</span> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      getValue: (e) => e.status,
      render: (e) => <StatusLabel status={e.status} />,
    },
  ];

  return <DataTable columns={columns} rows={events} emptyMessage="Tidak ada event yang cocok." />;
}

// ---------------------------------------------------------------------------
// Gantt view
// ---------------------------------------------------------------------------

export function EventGantt({ events, onEventClick }: { events: PublicEvent[]; onEventClick?: (event: PublicEvent) => void }) {
  const sorted = useMemo(() => [...events].sort((a, b) => eventStart(a).localeCompare(eventStart(b))), [events]);
  if (sorted.length === 0) return <Card className="text-sm text-neutral-500">Tidak ada event yang cocok.</Card>;

  const min = sorted.reduce((m, e) => (eventStart(e) < m ? eventStart(e) : m), eventStart(sorted[0]));
  let max = sorted.reduce((m, e) => (eventEnd(e) > m ? eventEnd(e) : m), eventEnd(sorted[0]));
  if (diffDays(min, max) < 13) max = addDays(min, 13); // keep bars readable
  const total = diffDays(min, max) + 1;

  // ~6 evenly spaced date ticks
  const tickStep = Math.max(1, Math.round(total / 6));
  const ticks: string[] = [];
  for (let i = 0; i < total; i += tickStep) ticks.push(addDays(min, i));

  const todayStr = ymd(new Date());
  const todayOffset = eventCoversDayRange(todayStr, min, max) ? (diffDays(min, todayStr) / total) * 100 : null;

  return (
    <Card className="overflow-x-auto p-0">
      <div className="min-w-[720px] p-4">
        {/* tick header */}
        <div className="relative ml-44 h-6 border-b border-neutral-200">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[10px] font-medium text-neutral-400"
              style={{ left: `${(diffDays(min, t) / total) * 100}%` }}
            >
              {parseShortDate(t)}
            </span>
          ))}
        </div>

        <div className="relative">
          {todayOffset !== null && (
            <div className="absolute bottom-0 top-0 z-10 w-px bg-primary/60" style={{ left: `calc(11rem + (100% - 11rem) * ${todayOffset / 100})` }} />
          )}
          {sorted.map((e) => {
            const left = (diffDays(min, eventStart(e)) / total) * 100;
            const width = Math.max(((diffDays(eventStart(e), eventEnd(e)) + 1) / total) * 100, 1.2);
            return (
              <div key={e.id} className="flex items-center gap-0 border-b border-neutral-100 py-1.5 last:border-b-0">
                <div className="w-44 shrink-0 truncate pr-3 text-xs font-medium text-neutral-700" title={e.namaKejuaraan}>
                  {e.namaKejuaraan}
                </div>
                <div className="relative h-5 flex-1">
                  <button
                    onClick={onEventClick ? () => onEventClick(e) : undefined}
                    title={`${e.namaKejuaraan} · ${formatEventDate(e)} · ${EVENT_STATUS_LABELS[e.status]}`}
                    className={`absolute top-0 h-5 rounded-full text-[10px] font-semibold text-white shadow-sm transition hover:opacity-85 ${STATUS_BG[e.status]} ${
                      onEventClick ? "cursor-pointer" : "cursor-default"
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="sr-only">{e.namaKejuaraan}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
          {EVENT_STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_BG[s]}`} /> {EVENT_STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function eventCoversDayRange(day: string, min: string, max: string): boolean {
  return min <= day && day <= max;
}

function parseShortDate(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
