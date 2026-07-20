import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  EVENT_LEVELS,
  EVENT_LEVEL_LABELS,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
} from "@inasportdb/shared-types";
import { Button, Combobox, Field, Input, Modal, Select } from "../../components/ui";
import { api } from "../../lib/api";
import type { PublicEvent } from "../public/eventShared";

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

function formFor(event: PublicEvent | "new", prefillDate?: string): EventForm {
  if (event === "new") return { ...emptyForm, tanggalMulai: prefillDate ?? "" };
  return {
    namaKejuaraan: event.namaKejuaraan,
    tingkat: event.tingkat,
    lokasi: event.lokasi ?? "",
    deskripsi: event.deskripsi ?? "",
    tanggalMulai: event.tanggalMulai.slice(0, 10),
    tanggalSelesai: event.tanggalSelesai ? event.tanggalSelesai.slice(0, 10) : "",
    cabangOlahragaId: event.cabangOlahraga?.id ?? "",
    status: event.status,
  };
}

interface Props {
  /** "new" opens an empty create form; an event opens it for editing. */
  event: PublicEvent | "new";
  /** Pre-selected start date when creating from a calendar day click. */
  prefillDate?: string;
  cabors: CaborOption[];
  /** Delete button, shown only when editing and the caller allows it. */
  onDelete?: (event: PublicEvent) => void;
  /** Fired after a successful save — the event list reloads on this. */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Event create/edit form (spec 017 §4), shared by the Kalender Event page and
 * the dashboard quick action. The dashboard opens it in place and only routes
 * to the calendar once a save succeeds, so a failed save leaves you put.
 */
export function EventFormModal({ event, prefillDate, cabors, onDelete, onSaved, onClose }: Props) {
  const [form, setForm] = useState<EventForm>(() => formFor(event, prefillDate));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.tanggalSelesai && form.tanggalSelesai < form.tanggalMulai) {
      toast.error("Tanggal selesai harus sama dengan atau setelah tanggal mulai.");
      return;
    }
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
      if (event === "new") {
        await api.post("/events", payload);
        toast.success("Event berhasil ditambahkan.");
      } else {
        await api.patch(`/events/${event.id}`, payload);
        toast.success("Event berhasil diperbarui.");
      }
      onSaved();
    } catch {
      toast.error("Gagal menyimpan event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={event === "new" ? "Tambah Event" : "Ubah Event"} onClose={onClose}>
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
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          {event !== "new" && onDelete && (
            <Button type="button" variant="danger" className="ml-auto" onClick={() => onDelete(event)}>
              <Trash2 size={14} /> Hapus
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
