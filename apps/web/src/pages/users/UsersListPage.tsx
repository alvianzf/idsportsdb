import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Badge, Select } from "../../components/ui";
import { api } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
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
  ATLET: "neutral",
};

export function UsersListPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setUsers(null);
    api
      .get<UserRow[]>("/users", { params: roleFilter ? { role: roleFilter } : undefined })
      .then((res) => setUsers(res.data))
      .catch(() => setError("Gagal memuat data pengguna."));
  }

  useEffect(load, [roleFilter]);

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

      <Card className="mb-4 flex items-center gap-3">
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "")}
          className="w-auto"
        >
          <option value="">Semua Role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </Select>
      </Card>

      {error && <Card className="mb-4 text-sm text-danger">{error}</Card>}

      <Card>
        {users === null ? (
          <p className="text-sm text-neutral-500">Memuat data...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-neutral-500">Belum ada pengguna.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Nama</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-2 font-medium text-neutral-900">{user.fullName}</td>
                    <td className="py-2 text-neutral-600">{user.email}</td>
                    <td className="py-2">
                      <Badge tone={ROLE_BADGE_TONE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                    </td>
                    <td className="py-2">
                      {user.isActive ? (
                        <Badge tone="success">Aktif</Badge>
                      ) : (
                        <Badge tone="neutral">Nonaktif</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Link to={`/users/${user.id}/edit`}>
                          <Button variant="outline">Edit</Button>
                        </Link>
                        {user.isActive && (
                          <Button
                            variant="outline"
                            onClick={() => handleDeactivate(user)}
                            className="border-danger/30 text-danger hover:bg-danger-light"
                          >
                            Nonaktifkan
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
