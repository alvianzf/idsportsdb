import { useEffect, useState } from "react";
import { Card, PageHeader, Badge, Pagination, DataTable, type Column } from "../../components/ui";
import { api } from "../../lib/api";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

const ACTION_TONE: Record<string, "success" | "info" | "danger" | "warning" | "neutral"> = {
  CREATE: "success",
  UPDATE: "info",
  UPDATE_ROLE: "info",
  RESET_PASSWORD: "warning",
  DEACTIVATE: "warning",
  DELETE: "danger",
  REJECTED: "danger",
  APPROVED: "success",
};

const pageSize = 50;

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    api
      .get<{ items: AuditRow[]; total: number }>("/audit", { params: { page, pageSize } })
      .then((res) => {
        setRows(res.data.items);
        setTotal(res.data.total);
      })
      .catch(() => setError("Gagal memuat riwayat aktivitas."));
  }, [page]);

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

      <Card>
        {rows === null ? (
          <p className="text-sm text-neutral-500">Memuat data...</p>
        ) : (
          <>
            <DataTable columns={columns} rows={rows} emptyMessage="Belum ada aktivitas tercatat." />
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
