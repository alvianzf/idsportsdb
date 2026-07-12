import type { PublicEvent } from "../public/eventShared";

/** Date-only string (YYYY-MM-DD) from an ISO datetime. */
export function ymd(value: string | Date): string {
  return (typeof value === "string" ? value : value.toISOString()).slice(0, 10);
}

/** Parse a YYYY-MM-DD at noon local time (avoids DST/timezone day shifts). */
export function parseYmd(s: string): Date {
  return new Date(`${s}T12:00:00`);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(new Date(d.getTime() - d.getTimezoneOffset() * 60000));
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
}

export function eventStart(e: PublicEvent): string {
  return ymd(e.tanggalMulai);
}

export function eventEnd(e: PublicEvent): string {
  return e.tanggalSelesai ? ymd(e.tanggalSelesai) : ymd(e.tanggalMulai);
}

export function eventCoversDay(e: PublicEvent, day: string): boolean {
  return eventStart(e) <= day && day <= eventEnd(e);
}

export interface EventFilters {
  search: string;
  date: string;
  status: string;
  tingkat: string;
  cabor: string;
}

export const EMPTY_FILTERS: EventFilters = { search: "", date: "", status: "", tingkat: "", cabor: "" };

/** Spec 017 §4 — search (nama, cabor, date) combinable with filters. */
export function filterEvents(events: PublicEvent[], f: EventFilters): PublicEvent[] {
  const q = f.search.trim().toLowerCase();
  return events.filter((e) => {
    if (q && !e.namaKejuaraan.toLowerCase().includes(q) && !(e.cabangOlahraga?.nama.toLowerCase().includes(q) ?? false)) {
      return false;
    }
    if (f.date && !eventCoversDay(e, f.date)) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.tingkat && e.tingkat !== f.tingkat) return false;
    if (f.cabor && e.cabangOlahraga?.id !== f.cabor) return false;
    return true;
  });
}

/** Month grid weeks (Monday-first), each week an array of 7 YYYY-MM-DD days. */
export function monthWeeks(monthFirstDay: string): string[][] {
  const first = parseYmd(monthFirstDay);
  const month = first.getMonth();
  // back up to Monday
  let cursor = monthFirstDay;
  const dow = (parseYmd(cursor).getDay() + 6) % 7; // 0 = Monday
  cursor = addDays(cursor, -dow);

  const weeks: string[][] = [];
  for (;;) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
    if (parseYmd(cursor).getMonth() !== month && weeks.length >= 4) break;
    if (weeks.length > 6) break;
  }
  return weeks;
}

export function firstOfMonth(day: string): string {
  return `${day.slice(0, 8)}01`;
}

export function shiftMonth(monthFirstDay: string, delta: number): string {
  const d = parseYmd(monthFirstDay);
  d.setMonth(d.getMonth() + delta, 1);
  return ymd(new Date(d.getTime() - d.getTimezoneOffset() * 60000));
}

export function monthLabel(monthFirstDay: string): string {
  return parseYmd(monthFirstDay).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
