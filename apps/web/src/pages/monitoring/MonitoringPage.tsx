import { useEffect, useMemo, useRef, useState } from "react";
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
import { DataTable, type Column } from "../../components/ui/DataTable";
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
    month: "short",
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
    return () => { socket.off("monitoring:change", refresh); };
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

  // ── DataTable columns ──────────────────────────────────────────────────────
  const columns = useMemo<Column<MonitoringEvent>[]>(() => {
    const base: Column<MonitoringEvent>[] = [
      {
        key: "atlet",
        label: "Atlet",
        mobile: true,
        render: (row) => (
          <Link
            to={`/atlet/${row.atlet.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-primary hover:underline"
          >
            {row.atlet.namaLengkap}
          </Link>
        ),
      },
      {
        key: "cabor",
        label: "Cabor",
        mobile: true,
        render: (row) => (
          <span className="text-neutral-600">
            {caborMap.get(row.atlet.cabangOlahragaId) ?? row.atlet.cabangOlahraga.nama}
          </span>
        ),
      },
      {
        key: "tanggal",
        label: "Tanggal",
        mobile: true,
        sortable: true,
        getValue: (row) => new Date(row.eventDate),
        render: (row) => (
          <span className="whitespace-nowrap text-neutral-500">{formatDate(row.eventDate)}</span>
        ),
      },
    ];

    if (activeTab === "MUTATION") {
      base.push({
        key: "status",
        label: "Status",
        mobile: true,
        render: (row) =>
          row.mutationStatus ? (
            <Badge tone={MUTATION_TONE[row.mutationStatus]}>
              {MUTATION_STATUS_LABELS[row.mutationStatus]}
            </Badge>
          ) : null,
      });
    }

    return base;
  }, [activeTab, caborMap]);

  // ── Expanded row content ───────────────────────────────────────────────────
  function expandContent(row: MonitoringEvent) {
    const caborNama = caborMap.get(row.atlet.cabangOlahragaId) ?? row.atlet.cabangOlahraga.nama;
    const toNama = row.toValue ? (caborMap.get(row.toValue) ?? row.toValue) : null;

    return (
      <dl className="grid gap-3 pt-1 text-sm sm:grid-cols-2 md:grid-cols-3">
        {row.description && (
          <div className="sm:col-span-2 md:col-span-3">
            <dt className="text-xs font-medium text-neutral-400">Keterangan</dt>
            <dd className="mt-0.5 text-neutral-700">{row.description}</dd>
          </div>
        )}
        {activeTab === "MUTATION" && toNama && (
          <div>
            <dt className="text-xs font-medium text-neutral-400">Pindah Ke</dt>
            <dd className="mt-0.5 font-medium text-neutral-800">
              <span className="text-neutral-400">{caborNama}</span>
              <span className="mx-2 text-neutral-300">→</span>
              {toNama}
            </dd>
          </div>
        )}
        {row.fromValue && activeTab !== "MUTATION" && (
          <div>
            <dt className="text-xs font-medium text-neutral-400">Dari</dt>
            <dd className="mt-0.5 text-neutral-700">{row.fromValue}</dd>
          </div>
        )}
        {row.toValue && activeTab !== "MUTATION" && (
          <div>
            <dt className="text-xs font-medium text-neutral-400">Ke</dt>
            <dd className="mt-0.5 text-neutral-700">{row.toValue}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-neutral-400">Tanggal Lengkap</dt>
          <dd className="mt-0.5 text-neutral-700">
            {new Date(row.eventDate).toLocaleDateString("id-ID", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </dd>
        </div>
      </dl>
    );
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
        // Mutation approval queue — card list with inline approve/reject actions
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
        <Card className="p-0">
          <DataTable
            columns={columns}
            rows={events}
            emptyMessage={`Belum ada data ${activeTabDef.label.toLowerCase()}.`}
            expandContent={expandContent}
          />
        </Card>
      )}
    </div>
  );
}
