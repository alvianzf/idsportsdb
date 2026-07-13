export const ROLES = [
  "SUPER_ADMIN_KONI",
  "ADMIN_KONI",
  "ADMIN_CABOR",
  "ATLET",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN_KONI: "Super Admin KONI",
  ADMIN_KONI: "Admin KONI",
  ADMIN_CABOR: "Admin Cabang Olahraga",
  ATLET: "Atlet",
};

/** Roles that can manage data across all cabor (not scoped to a single cabangOlahragaId). */
export const UNSCOPED_ADMIN_ROLES: Role[] = ["SUPER_ADMIN_KONI", "ADMIN_KONI"];

/** Roles that can write master data (subject to scoping for ADMIN_CABOR). */
export const DATA_ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN_KONI",
  "ADMIN_KONI",
  "ADMIN_CABOR",
];
