import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { ROLE_LABELS } from "@inasportdb/shared-types";
import { Modal, Button, DropZone, Field, Input, PasswordInput } from "./ui";
import { api, resolveFileUrl } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, setSession, accessToken, refreshToken } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
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
      let avatarUrl = user?.avatarUrl ?? null;
      if (avatarFile) {
        const form = new FormData();
        form.append("file", avatarFile);
        const avatarRes = await api.post("/auth/me/avatar", form);
        avatarUrl = avatarRes.data.avatarUrl;
      } else if (removeAvatar && avatarUrl) {
        await api.delete("/auth/me/avatar");
        avatarUrl = null;
      }
      const res = await api.patch("/auth/me", {
        fullName,
        ...(password ? { password } : {}),
      });
      if (user && accessToken && refreshToken) {
        setSession(accessToken, refreshToken, { ...user, fullName: res.data.fullName, avatarUrl });
      }
      toast.success("Profil berhasil diperbarui.");
      onClose();
    } catch {
      toast.error("Gagal memperbarui profil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Profil Saya" onClose={onClose}>
      <div className="mb-4 space-y-1 text-sm">
        <p className="text-neutral-500">Email: <span className="font-medium text-neutral-900">{user?.email}</span></p>
        <p className="text-neutral-500">Role: <span className="font-medium text-neutral-900">{user?.role ? ROLE_LABELS[user.role] : "-"}</span></p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Foto Profil" htmlFor="avatar">
          <DropZone
            accept="image/*"
            value={avatarFile}
            onChange={(f) => {
              if (f) {
                setAvatarFile(f);
                setRemoveAvatar(false);
              } else if (avatarFile) {
                // Un-stage the new file; the existing photo stays.
                setAvatarFile(null);
              } else {
                // X on the existing photo — delete it on save.
                setRemoveAvatar(true);
              }
            }}
            existingUrl={!removeAvatar && user?.avatarUrl ? resolveFileUrl(user.avatarUrl) : null}
            label="Seret & lepas foto di sini"
            sublabel="JPG/PNG/WebP"
          />
        </Field>
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
    </Modal>
  );
}
