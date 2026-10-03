import { useEffect, useState } from "react";
import { Card, PageHeader, Badge, Pagination, DataTable, Select, Input, Button, type Column } from "../../components/ui";
import { api } from "../../lib/api";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

interface UserOption {
  id: string;
  fullName: string;
}

const ACTION_TONE: Record<string, "success" | "info" | "danger" | "warning" | "neutral"> = {
  CREATE: "success",
  UPDATE: "info",
  UPDATE_ROLE: "info",
  RESET_PASSWORD: "warning",
  DEACTIVATE: "warning",
  RESTORE: "success",
  DELETE: "danger",
  PERMANENT_DELETE: "danger",
  REJECTED: "danger",
  APPROVED: "success",
};

const pageSize = 50;

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    api.get<UserOption[]>("/users").then((res) => setUsers(res.data)).catch(() => undefined);
    api.get<string[]>("/audit/entities").then((res) => setEntities(res.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    setRows(null);
    api
      .get<{ items: AuditRow[]; total: number }>("/audit", {
        params: {
          page,
          pageSize,
          userId: userId || undefined,
          entity: entity || undefined,
          action: action || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      })
      .then((res) => {
        setRows(res.data.items);
        setTotal(res.data.total);
      })
      .catch(() => setError("Gagal memuat riwayat aktivitas."));
  }, [page, userId, entity, action, from, to]);

  function resetFilters() {
    setUserId("");
    setEntity("");
    setAction("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const hasFilters = Boolean(userId || entity || action || from || to);

  const columns: Column<AuditRow>[] = [
    {
      key: "createdAt",
      label: "Waktu",
      mobile: true,
      render: (r) => (
        <span className="whitespace-nowrap text-neutral-600">
          {new Date(r.createdAt).toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      key: "user",
      label: "Pengguna",
      mobile: true,
      render: (r) => (
        <span className="font-medium text-neutral-900">{r.user?.fullName ?? "—"}</span>
      ),
    },
    {
      key: "action",
      label: "Aksi",
      render: (r) => <Badge tone={ACTION_TONE[r.action] ?? "neutral"}>{r.action}</Badge>,
    },
    {
      key: "entity",
      label: "Entitas",
      render: (r) => <span className="text-neutral-700">{r.entity}</span>,
    },
    {
      key: "entityId",
      label: "ID Entitas",
      render: (r) => <span className="font-mono text-xs text-neutral-500">{r.entityId}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Riwayat Aktivitas" description="Catatan perubahan data oleh pengguna sistem" />

      {error && <Card className="mb-4 text-sm text-danger">{error}</Card>}

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            value={userId}
            onChange={(v) => { setPage(1); setUserId(v); }}
            options={[{ value: "", label: "Semua Pengguna" }, ...users.map((u) => ({ value: u.id, label: u.fullName }))]}
          />
          <Select
            value={entity}
            onChange={(v) => { setPage(1); setEntity(v); }}
            options={[{ value: "", label: "Semua Entitas" }, ...entities.map((e) => ({ value: e, label: e }))]}
          />
          <Select
            value={action}
            onChange={(v) => { setPage(1); setAction(v); }}
            options={[{ value: "", label: "Semua Aksi" }, ...Object.keys(ACTION_TONE).map((a) => ({ value: a, label: a }))]}
          />
          <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} aria-label="Dari tanggal" />
          <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} aria-label="Sampai tanggal" />
        </div>
        {hasFilters && (
          <Button variant="outline" className="mt-3" onClick={resetFilters}>
            Reset Filter
          </Button>
        )}
      </Card>

      <Card>
        {rows === null ? (
          <p className="text-sm text-neutral-500">Memuat data...</p>
        ) : (
          <>
            <DataTable columns={columns} rows={rows} emptyMessage="Tidak ada aktivitas yang cocok dengan filter." />
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
