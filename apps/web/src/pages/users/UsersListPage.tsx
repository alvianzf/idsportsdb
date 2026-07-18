import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role } from "@inasportdb/shared-types";
import { ActionMenu, Card, PageHeader, Button, Badge, Select, DataTable, type Column, type BulkAction } from "../../components/ui";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  cabangOlahragaId: string | null;
  cabangOlahraga?: { nama: string } | null;
  createdAt: string;
}

const ROLE_BADGE_TONE: Record<Role, "danger" | "info" | "warning" | "neutral"> = {
  SUPER_ADMIN_KONI: "danger",
  ADMIN_KONI: "info",
  ADMIN_CABOR: "warning",
  ADMIN_DISPORA: "info",
  ATLET: "neutral",
};

export function UsersListPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [error, setError] = useState<string | null>(null);
  const currentRole = useAuthStore((state) => state.user?.role);

  // ADMIN_KONI may not act on SUPER_ADMIN_KONI / ADMIN_KONI accounts (API 403s
  // too); hide their row actions. SUPER_ADMIN_KONI may manage everyone.
  const canManage = (row: UserRow) =>
    currentRole !== "ADMIN_KONI" ||
    (row.role !== "SUPER_ADMIN_KONI" && row.role !== "ADMIN_KONI");

  function load() {
    setUsers(null);
    api
      .get<UserRow[]>("/users", { params: roleFilter ? { role: roleFilter } : undefined })
      .then((res) => setUsers(res.data))
      .catch(() => setError("Gagal memuat data pengguna."));
  }

  useEffect(load, [roleFilter]);

  async function handleResetPassword(user: UserRow) {
    const confirmed = await confirmAction({
      text: `Reset kata sandi ${user.fullName}? Kata sandi baru akan dikirim ke ${user.email}.`,
      confirmText: "Reset",
    });
    if (!confirmed) return;
    try {
      await api.post(`/users/${user.id}/reset-password`);
      toast.success(`Kata sandi direset. Email dikirim ke ${user.email}.`);
    } catch {
      toast.error("Gagal mereset kata sandi.");
    }
  }

  async function handleDeactivate(user: UserRow) {
    const confirmed = await confirmAction({
      text: `Nonaktifkan akun ${user.fullName}? Pengguna tidak akan bisa login lagi.`,
      danger: true,
      confirmText: "Nonaktifkan",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success("Akun berhasil dinonaktifkan.");
      load();
    } catch {
      toast.error("Gagal menonaktifkan akun.");
    }
  }

  // Revisi 2026-07-18: reactivate a deactivated account.
  async function handleActivate(user: UserRow) {
    try {
      await api.patch(`/users/${user.id}`, { isActive: true });
      toast.success("Akun berhasil diaktifkan.");
      load();
    } catch {
      toast.error("Gagal mengaktifkan akun.");
    }
  }

  async function handleDelete(user: UserRow) {
    const confirmed = await confirmAction({
      text: `Hapus permanen akun ${user.fullName}? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmText: "Hapus Permanen",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/users/${user.id}/permanent`);
      toast.success("Akun berhasil dihapus permanen.");
      load();
    } catch {
      toast.error("Gagal menghapus akun.");
    }
  }

  async function handleBulkDeactivate(ids: string[]) {
    const confirmed = await confirmAction({
      text: `Nonaktifkan ${ids.length} akun pengguna? Pengguna tidak akan bisa login lagi.`,
      danger: true,
      confirmText: "Nonaktifkan",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/users/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${ids.length} akun berhasil dinonaktifkan.`);
    } else {
      toast.error(`${failed} dari ${ids.length} akun gagal dinonaktifkan.`);
    }
    load();
  }

  const columns: Column<UserRow>[] = [
    {
      key: "fullName",
      label: "Nama",
      mobile: true,
      sortable: true,
      getValue: (r) => r.fullName,
      render: (r) => <span className="font-medium text-neutral-900">{r.fullName}</span>,
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      getValue: (r) => r.email,
      render: (r) => <span className="text-neutral-600">{r.email}</span>,
    },
    {
      key: "role",
      label: "Role",
      mobile: true,
      sortable: true,
      getValue: (r) => r.role,
      render: (r) => <Badge tone={ROLE_BADGE_TONE[r.role]}>{ROLE_LABELS[r.role]}</Badge>,
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      getValue: (r) => (r.isActive ? "1" : "0"),
      render: (r) =>
        r.isActive ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>,
    },
    {
      key: "aksi",
      label: "Aksi",
      render: (user) =>
        canManage(user) ? (
          // Revisi 2026-07-18: all row actions live in a three-dots dropdown.
          <ActionMenu
            items={[
              { label: "Edit", icon: Pencil, onClick: () => navigate(`/users/${user.id}/edit`) },
              { label: "Reset kata sandi", icon: KeyRound, onClick: () => handleResetPassword(user) },
              user.isActive
                ? { label: "Nonaktifkan", icon: Lock, onClick: () => handleDeactivate(user) }
                : { label: "Aktifkan", icon: LockOpen, onClick: () => handleActivate(user) },
              { label: "Hapus permanen", icon: Trash2, danger: true, onClick: () => handleDelete(user) },
            ]}
          />
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        ),
    },
  ];

  const bulkActions: BulkAction[] = [
    { label: "Nonaktifkan", variant: "danger", onClick: handleBulkDeactivate },
  ];

  return (
    <div>
      <PageHeader
        title="Pengguna"
        description="Kelola akun pengguna sistem"
        actions={
          <Link to="/users/new">
            <Button>
              <Plus size={16} />
              Tambah Pengguna
            </Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <Select
          value={roleFilter}
          onChange={(v) => setRoleFilter(v as Role | "")}
          options={[{ value: "", label: "Semua Role" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))]}
          className="w-full"
        />
      </Card>

      {error && <Card className="mb-4 text-sm text-danger">{error}</Card>}

      <Card>
        {users === null ? (
          <p className="text-sm text-neutral-500">Memuat data...</p>
        ) : (
          <DataTable columns={columns} rows={users} bulkActions={bulkActions} emptyMessage="Belum ada pengguna." />
        )}
      </Card>
    </div>
  );
}
