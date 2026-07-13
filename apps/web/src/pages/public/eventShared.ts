import type { EventLevel, EventStatus } from "@inasportdb/shared-types";

export interface PublicEvent {
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

export const EVENT_STATUS_TONE: Record<EventStatus, "success" | "danger" | "warning" | "info"> = {
  SELESAI: "success",
  ON_TRACK: "info",
  DIBATALKAN: "danger",
  DIUNDUR: "warning",
};

/** Plain colored-text classes — public pages carry no badge pills. */
export const EVENT_STATUS_TEXT: Record<EventStatus, string> = {
  SELESAI: "text-success",
  ON_TRACK: "text-info",
  DIBATALKAN: "text-danger",
  DIUNDUR: "text-warning",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

export function formatEventDate(event: Pick<PublicEvent, "tanggalMulai" | "tanggalSelesai">) {
  const start = formatDate(event.tanggalMulai);
  if (!event.tanggalSelesai || event.tanggalSelesai.slice(0, 10) === event.tanggalMulai.slice(0, 10)) return start;
  return `${start} – ${formatDate(event.tanggalSelesai)}`;
}
