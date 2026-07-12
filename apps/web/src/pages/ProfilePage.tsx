import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { ROLE_LABELS } from "@inasportdb/shared-types";
import { Card, PageHeader, Button, Field, Input, PasswordInput } from "../components/ui";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function ProfilePage() {
  const { user, setSession, accessToken, refreshToken } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password && password !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch("/auth/me", {
        fullName,
        ...(password ? { password } : {}),
      });
      if (user && accessToken && refreshToken) {
        setSession(accessToken, refreshToken, { ...user, fullName: res.data.fullName });
      }
      setPassword("");
      setConfirmPassword("");
      toast.success("Profil berhasil diperbarui.");
    } catch {
      toast.error("Gagal memperbarui profil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Profil Saya" description="Ubah nama dan password akun Anda" />
      <Card className="max-w-md">
        <div className="mb-4 space-y-1 text-sm">
          <p className="text-neutral-500">Email: <span className="font-medium text-neutral-900">{user?.email}</span></p>
          <p className="text-neutral-500">Role: <span className="font-medium text-neutral-900">{user?.role ? ROLE_LABELS[user.role] : "-"}</span></p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama Lengkap" required htmlFor="fullName">
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label="Password Baru (kosongkan jika tidak diubah)" htmlFor="password">
            <PasswordInput
              id="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </Field>
          {password && (
            <Field label="Konfirmasi Password" required htmlFor="confirmPassword">
              <PasswordInput
                id="confirmPassword"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
