import { useEffect, useState } from "react";
import { UNSCOPED_VIEW_ROLES } from "@inasportdb/shared-types";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export interface CaborOption {
  id: string;
  nama: string;
}

/** Fetches the cabor list for all-cabor viewers (KONI admins + DISPORA), used in cabor filter dropdowns. */
export function useCaborOptions() {
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = !!role && UNSCOPED_VIEW_ROLES.includes(role);
  const [cabors, setCabors] = useState<CaborOption[]>([]);

  useEffect(() => {
    if (!isUnscopedAdmin) return;
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
  }, [isUnscopedAdmin]);

  return { cabors, isUnscopedAdmin };
}
