import {
  LayoutDashboard,
  Users,
  UserCog,
  Trophy,
  Building2,
  Activity,
  CalendarDays,
  Images,
  FileBarChart,
  ShieldCheck,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@inasportdb/shared-types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom nav. */
  mobile?: boolean;
  /** Renders as the center FAB button in the mobile bottom nav. */
  center?: boolean;
  roles: Role[];
}

export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true, roles: ADMIN_ROLES },
  { to: "/atlet", label: "Atlet", icon: Users, mobile: true, roles: ADMIN_ROLES },
  { to: "/monitoring", label: "Monitoring", icon: Activity, mobile: true, roles: ADMIN_ROLES },
  { to: "/reports", label: "Pelaporan", icon: FileBarChart, mobile: true, roles: ADMIN_ROLES },
  { to: "/prestasi", label: "Prestasi", icon: Trophy, roles: ADMIN_ROLES },
  { to: "/events", label: "Event", icon: CalendarDays, roles: ADMIN_ROLES },
  { to: "/pelatih", label: "Pelatih", icon: UserCog, roles: ADMIN_ROLES },
  { to: "/cabor", label: "Cabang Olahraga", icon: Building2, roles: ADMIN_ROLES },
  { to: "/artikel", label: "Pengumuman", icon: Newspaper, roles: ["SUPER_ADMIN_KONI", "ADMIN_KONI"] },
  { to: "/slider", label: "Slider Beranda", icon: Images, roles: ["SUPER_ADMIN_KONI"] },
  { to: "/users", label: "Pengguna", icon: ShieldCheck, roles: ["SUPER_ADMIN_KONI"] },
];

export const ATLET_NAV_ITEMS: NavItem[] = [
  { to: "/me", label: "Profil Saya", icon: Users, mobile: true, roles: ["ATLET"] },
  { to: "/me/prestasi", label: "Prestasi", icon: Trophy, mobile: true, roles: ["ATLET"] },
];

export function navItemsForRole(role: Role): NavItem[] {
  const source = role === "ATLET" ? ATLET_NAV_ITEMS : ADMIN_NAV_ITEMS;
  return source.filter((item) => item.roles.includes(role));
}
