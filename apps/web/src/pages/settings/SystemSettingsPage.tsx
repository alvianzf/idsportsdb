import { Link } from "react-router-dom";
import {
  Building2,
  History,
  Images,
  Newspaper,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Card, PageHeader } from "../../components/ui";

// Revisi 2026-07-18: SUPER_ADMIN hub gathering its system capabilities.
const SETTINGS: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  { to: "/users", title: "Kelola Pengguna", description: "Aktifkan, nonaktifkan, reset kata sandi, dan hapus akun", icon: ShieldCheck },
  { to: "/users/new", title: "Buat Akun Baru", description: "Buat akun admin KONI, admin cabor, admin DISPORA, atau atlet", icon: UserPlus },
  { to: "/cabor", title: "Kelola Cabang Olahraga", description: "Aktifkan/nonaktifkan cabor dan kelola datanya", icon: Building2 },
  { to: "/cabor/new", title: "Tambah Cabang Olahraga", description: "Daftarkan cabang olahraga baru", icon: Building2 },
  { to: "/artikel", title: "Pengumuman", description: "Kelola artikel dan pengumuman di beranda", icon: Newspaper },
  { to: "/slider", title: "Slider Beranda", description: "Atur gambar slider halaman depan", icon: Images },
  { to: "/audit", title: "Riwayat Aktivitas", description: "Audit log seluruh aktivitas pengguna", icon: History },
];

/** Revisi 2026-07-18 — Pengaturan Sistem hub, SUPER_ADMIN_KONI only. */
export function SystemSettingsPage() {
  return (
    <div>
      <PageHeader title="Pengaturan Sistem" description="Kapabilitas administrasi sistem untuk Super Admin" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="h-full transition-colors hover:border-primary">
              <s.icon className="mb-2 text-primary" size={24} />
              <h2 className="font-medium text-neutral-900">{s.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
