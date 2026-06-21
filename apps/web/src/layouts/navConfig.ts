import {
  LayoutDashboard,
  Users,
  UserCog,
  Trophy,
  Building2,
  Activity,
  FileBarChart,
  ShieldCheck,
  Newspaper,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@inasportdb/shared-types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom nav (max 4 items, keep this list short). */
  mobile?: boolean;
  roles: Role[];
}

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true, roles: ADMIN_ROLES },
  { to: "/atlet", label: "Atlet", icon: Users, mobile: true, roles: ADMIN_ROLES },
  { to: "/scan", label: "Scan Kartu", icon: ScanLine, mobile: true, roles: ADMIN_ROLES },
  { to: "/reports", label: "Pelaporan", icon: FileBarChart, mobile: true, roles: ADMIN_ROLES },
  { to: "/prestasi", label: "Prestasi", icon: Trophy, roles: ADMIN_ROLES },
  { to: "/pelatih", label: "Pelatih", icon: UserCog, roles: ADMIN_ROLES },
  { to: "/cabor", label: "Cabang Olahraga", icon: Building2, roles: ADMIN_ROLES },
  { to: "/monitoring", label: "Monitoring", icon: Activity, roles: ADMIN_ROLES },
  { to: "/artikel", label: "Pengumuman", icon: Newspaper, roles: ["SUPER_ADMIN_KONI", "ADMIN_KONI"] },
  { to: "/users", label: "Pengguna", icon: ShieldCheck, roles: ["SUPER_ADMIN_KONI"] },
];

export const ATLET_NAV_ITEMS: NavItem[] = [
  { to: "/me", label: "Profil Saya", icon: Users, mobile: true, roles: ["ATLET"] },
  { to: "/me/prestasi", label: "Prestasi", icon: Trophy, mobile: true, roles: ["ATLET"] },
  { to: "/me/card", label: "Kartu Digital", icon: ShieldCheck, mobile: true, roles: ["ATLET"] },
];

export function navItemsForRole(role: Role): NavItem[] {
  const source = role === "ATLET" ? ATLET_NAV_ITEMS : ADMIN_NAV_ITEMS;
  return source.filter((item) => item.roles.includes(role));
}
