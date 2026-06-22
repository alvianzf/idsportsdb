import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  ATHLETE_STATUSES,
  ATHLETE_STATUS_LABELS,
  MONITORING_EVENT_TYPES,
  MONITORING_EVENT_TYPE_LABELS,
  MUTATION_STATUS_LABELS,
  type AthleteStatus,
  type MonitoringEventType,
  type MutationStatus,
} from "@inasportdb/shared-types";
import { Card, Button, Badge, Field, Input, Select, Textarea, Modal, Combobox } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";

interface MonitoringEvent {
  id: string;
  type: MonitoringEventType;
  description: string | null;
  fromValue: string | null;
  toValue: string | null;
  eventDate: string;
  mutationStatus: MutationStatus | null;
}

interface CaborOption {
  id: string;
  nama: string;
}

interface MonitoringForm {
  type: MonitoringEventType;
  description: string;
  fromValue: string;
  toValue: string;
  eventDate: string;
}

function emptyForm(): MonitoringForm {
  return {
    type: "INJURY",
    description: "",
    fromValue: "",
    toValue: "",
    eventDate: new Date().toISOString().slice(0, 10),
  };
}

const MUTATION_TONE: Record<MutationStatus, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

function extractError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "fieldErrors" in (data as object)) {
    const fieldErrors = (data as { fieldErrors: Record<string, string[]> }).fieldErrors;
    const first = Object.values(fieldErrors).flat()[0];
    if (first) return first;
  }
  return "Gagal menyimpan data.";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

function describeValue(type: MonitoringEventType, value: string | null, caborMap: Map<string, string>) {
  if (!value) return "-";
  if (type === "STATUS_CHANGE") return ATHLETE_STATUS_LABELS[value as AthleteStatus] ?? value;
  if (type === "MUTATION") return caborMap.get(value) ?? value;
  return value;
}

interface MonitoringTabProps {
  atletId: string;
  canManage: boolean;
  currentCabangOlahragaId: string;
}

export function MonitoringTab({ atletId, canManage, currentCabangOlahragaId }: MonitoringTabProps) {
  const role = useAuthStore((state) => state.user?.role);
  const [items, setItems] = useState<MonitoringEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caborOptions, setCaborOptions] = useState<CaborOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MonitoringEvent | null>(null);
  const [form, setForm] = useState<MonitoringForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get<MonitoringEvent[]>(`/atlet/${atletId}/monitoring`)
      .then((res) => setItems(res.data))
      .catch(() => setError("Gagal memuat data monitoring."));
  }

  useEffect(load, [atletId]);

  useEffect(() => {
    api
      .get<CaborOption[]>("/cabor")
      .then((res) => setCaborOptions(res.data))
      .catch(() => undefined);
  }, []);

  const caborMap = new Map(caborOptions.map((c) => [c.id, c.nama]));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(event: MonitoringEvent) {
    setEditing(event);
    setForm({
      type: event.type,
      description: event.description ?? "",
      fromValue: event.fromValue ?? "",
      toValue: event.toValue ?? "",
      eventDate: event.eventDate.slice(0, 10),
    });
    setFormError(null);
    setModalOpen(true);
  }

  function canEdit(event: MonitoringEvent) {
    if (!canManage) return false;
    if (role === "ADMIN_CABOR" && event.type === "MUTATION") return false;
    return true;
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        description: form.description || undefined,
        fromValue: form.fromValue || undefined,
        toValue: form.toValue || undefined,
        eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined,
      };
      if (editing) {
        await api.patch(`/monitoring/${editing.id}`, payload);
      } else {
        await api.post(`/atlet/${atletId}/monitoring`, { type: form.type, ...payload });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Card className="text-sm text-danger">{error}</Card>;
  if (items === null) return <Card className="text-sm text-neutral-500">Memuat data...</Card>;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Monitoring</h2>
        {canManage && (
          <Button variant="outline" onClick={openCreate}>
            <Plus size={16} /> Tambah
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Belum ada data monitoring.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((event) => (
            <li key={event.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">
                      {MONITORING_EVENT_TYPE_LABELS[event.type]}
                    </span>
                    {event.type === "MUTATION" && event.mutationStatus && (
                      <Badge tone={MUTATION_TONE[event.mutationStatus]}>
                        {MUTATION_STATUS_LABELS[event.mutationStatus]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{formatDate(event.eventDate)}</p>
                  {event.description && <p className="mt-1 text-neutral-700">{event.description}</p>}
                  {(event.fromValue || event.toValue) && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {describeValue(event.type, event.fromValue, caborMap)} &rarr;{" "}
                      {describeValue(event.type, event.toValue, caborMap)}
                    </p>
                  )}
                </div>
                {canEdit(event) && (
                  <button
                    onClick={() => openEdit(event)}
                    aria-label="Ubah"
                    className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <Modal title={editing ? "Ubah Monitoring" : "Tambah Monitoring"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Jenis Monitoring" required htmlFor="type">
              <Select
                id="type"
                required
                disabled={!!editing}
                value={form.type}
                onChange={(v) => setForm((f) => ({ ...f, type: v as MonitoringEventType, toValue: "" }))}
                options={MONITORING_EVENT_TYPES.map((t) => ({ value: t, label: MONITORING_EVENT_TYPE_LABELS[t] }))}
              />
            </Field>

            <Field label="Keterangan" htmlFor="description">
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              {form.type === "MUTATION" ? (
                <>
                  <Field label="Dari Cabor">
                    <Input value={caborMap.get(currentCabangOlahragaId) ?? "-"} disabled />
                  </Field>
                  <Field label="Ke Cabor" required htmlFor="toValue">
                    <Combobox
                      id="toValue"
                      required
                      value={form.toValue}
                      onChange={(v) => setForm((f) => ({ ...f, toValue: v }))}
                      options={caborOptions
                        .filter((c) => c.id !== currentCabangOlahragaId)
                        .map((c) => ({ value: c.id, label: c.nama }))}
                      placeholder="Pilih cabor"
                    />
                  </Field>
                </>
              ) : form.type === "STATUS_CHANGE" ? (
                <>
                  <Field label="Dari Status" htmlFor="fromValue">
                    <Select
                      id="fromValue"
                      value={form.fromValue}
                      onChange={(v) => setForm((f) => ({ ...f, fromValue: v }))}
                      options={[{ value: "", label: "-" }, ...ATHLETE_STATUSES.map((s) => ({ value: s, label: ATHLETE_STATUS_LABELS[s] }))]}
                    />
                  </Field>
                  <Field label="Ke Status" required htmlFor="toValue">
                    <Select
                      id="toValue"
                      required
                      value={form.toValue}
                      onChange={(v) => setForm((f) => ({ ...f, toValue: v }))}
                      options={[{ value: "", label: "Pilih status" }, ...ATHLETE_STATUSES.map((s) => ({ value: s, label: ATHLETE_STATUS_LABELS[s] }))]}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Dari" htmlFor="fromValue">
                    <Input
                      id="fromValue"
                      value={form.fromValue}
                      onChange={(e) => setForm((f) => ({ ...f, fromValue: e.target.value }))}
                    />
                  </Field>
                  <Field label="Ke" htmlFor="toValue">
                    <Input
                      id="toValue"
                      value={form.toValue}
                      onChange={(e) => setForm((f) => ({ ...f, toValue: e.target.value }))}
                    />
                  </Field>
                </>
              )}
            </div>

            <Field label="Tanggal Kejadian" required htmlFor="eventDate">
              <Input
                id="eventDate"
                type="date"
                required
                value={form.eventDate}
                onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
              />
            </Field>

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
