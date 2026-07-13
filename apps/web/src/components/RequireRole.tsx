import type { ReactNode } from "react";
import type { Role } from "@inasportdb/shared-types";
import { useAuthStore } from "../store/authStore";
import { ForbiddenPage } from "../pages/ForbiddenPage";

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
}

/** Renders `children` only if the current user's role is in `roles`, else a 403 page. */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const role = useAuthStore((state) => state.user?.role);
  if (!role || !roles.includes(role)) {
    return <ForbiddenPage />;
  }
  return <>{children}</>;
}
