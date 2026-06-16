import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  MUTATION_STATUSES,
  MUTATION_STATUS_LABELS,
  type MonitoringEventType,
  type MutationStatus,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Badge } from "../../components/ui";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/authStore";

interface MonitoringEvent {
  id: string;
  type: MonitoringEventType;
  description: string | null;
  fromValue: string | null;
  toValue: string | null;
  eventDate: string;
  mutationStatus: MutationStatus | null;
  atlet: {
    id: string;
    namaLengkap: string;
    cabangOlahragaId: string;
    cabangOlahraga: { id: string; nama: string };
  };
}

type TabType = "INJURY" | "MUTATION" | "TRAINING_CAMP" | "SELECTION";

const TABS: { type: TabType; label: string }[] = [
  { type: "INJURY", label: "Cedera" },
  { type: "MUTATION", label: "Mutasi Atlet" },
  { type: "TRAINING_CAMP", label: "Pemusatan Latihan" },
  { type: "SELECTION", label: "Seleksi Atlet" },
];

const MUTATION_TONE: Record<MutationStatus, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function MonitoringPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isApprover = role === "SUPER_ADMIN_KONI" || role === "ADMIN_KONI";

  const [activeTab, setActiveTab] = useState<TabType>("INJURY");
  const [events, setEvents] = useState<MonitoringEvent[] | null>(null);
  const [mutasiStatus, setMutasiStatus] = useState<MutationStatus>("PENDING");
  const [caborMap, setCaborMap] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRef = useRef<() => void>(() => undefined);

  function load() {
    setEvents(null);
    setError(null);

    if (activeTab === "MUTATION" && isApprover) {
      api
        .get<MonitoringEvent[]>("/monitoring/mutasi", { params: { status: mutasiStatus } })
        .then((res) => setEvents(res.data))
        .catch(() => setError("Gagal memuat data mutasi."));
    } else {
      api
        .get<MonitoringEvent[]>("/monitoring", { params: { type: activeTab } })
        .then((res) => setEvents(res.data))
        .catch(() => setError("Gagal memuat data monitoring."));
    }
  }

  loadRef.current = load;

  useEffect(load, [activeTab, mutasiStatus, isApprover]);

  useEffect(() => {
    api
      .get<{ id: string; nama: string }[]>("/cabor")
      .then((res) => setCaborMap(new Map(res.data.map((c) => [c.id, c.nama]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => loadRef.current();
    socket.on("monitoring:change", refresh);
    return () => {
      socket.off("monitoring:change", refresh);
    };
  }, []);

  async function handleAction(id: string, action: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      await api.patch(`/monitoring/${id}/mutasi`, { status: action });
      toast.success(action === "APPROVED" ? "Mutasi disetujui." : "Mutasi ditolak.");
      load();
    } catch {
      toast.error("Gagal memproses mutasi.");
    } finally {
      setBusyId(null);
    }
  }

  const activeTabDef = TABS.find((t) => t.type === activeTab)!;

  return (
    <div>
      <PageHeader
        title="Monitoring Atlet"
        description="Rekam jejak cedera, mutasi, pemusatan latihan, dan seleksi atlet"
      />

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((tab) => (
          <button
            key={tab.type}
            onClick={() => setActiveTab(tab.type)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.type
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mutasi status sub-tabs (approver only) */}
      {activeTab === "MUTATION" && isApprover && (
        <div className="mb-4 flex gap-1">
          {MUTATION_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setMutasiStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                mutasiStatus === s
                  ? "bg-primary text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {MUTATION_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {error && <Card className="mb-4 text-sm text-danger">{error}</Card>}

      {events === null ? (
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : events.length === 0 ? (
        <Card className="text-sm text-neutral-500">
          Belum ada data {activeTabDef.label.toLowerCase()}.
        </Card>
      ) : activeTab === "MUTATION" && isApprover ? (
        // Mutation approval queue — card list with actions
        <ul className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/atlet/${event.atlet.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {event.atlet.namaLengkap}
                  </Link>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    {caborMap.get(event.atlet.cabangOlahragaId) ?? event.atlet.cabangOlahraga.nama}
                    {event.toValue && (
                      <> &rarr; {caborMap.get(event.toValue) ?? event.toValue}</>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{formatDate(event.eventDate)}</p>
                  {event.description && (
                    <p className="mt-1 text-sm text-neutral-700">{event.description}</p>
                  )}
                </div>
                {event.mutationStatus && (
                  <Badge tone={MUTATION_TONE[event.mutationStatus]}>
                    {MUTATION_STATUS_LABELS[event.mutationStatus]}
                  </Badge>
                )}
              </div>
              {event.mutationStatus === "PENDING" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busyId === event.id}
                    onClick={() => handleAction(event.id, "APPROVED")}
                  >
                    <Check size={16} /> Setujui
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === event.id}
                    onClick={() => handleAction(event.id, "REJECTED")}
                  >
                    <X size={16} /> Tolak
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </ul>
      ) : (
        // General event list — table
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Atlet</th>
                  <th className="pb-2 font-medium">Cabor</th>
                  <th className="pb-2 font-medium">Tanggal</th>
                  <th className="pb-2 font-medium">Deskripsi</th>
                  {activeTab === "MUTATION" && <th className="pb-2 font-medium">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="py-2">
                      <Link
                        to={`/atlet/${event.atlet.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {event.atlet.namaLengkap}
                      </Link>
                    </td>
                    <td className="py-2 text-neutral-600">
                      {caborMap.get(event.atlet.cabangOlahragaId) ??
                        event.atlet.cabangOlahraga.nama}
                    </td>
                    <td className="py-2 text-neutral-500 whitespace-nowrap">
                      {formatDate(event.eventDate)}
                    </td>
                    <td className="py-2 text-neutral-700 max-w-xs truncate">
                      {event.description ?? "-"}
                    </td>
                    {activeTab === "MUTATION" && event.mutationStatus && (
                      <td className="py-2">
                        <Badge tone={MUTATION_TONE[event.mutationStatus]}>
                          {MUTATION_STATUS_LABELS[event.mutationStatus]}
                        </Badge>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
