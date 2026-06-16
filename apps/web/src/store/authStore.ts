import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@inasportdb/shared-types";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  cabangOlahragaId?: string | null;
  athleteId?: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "koni-auth" },
  ),
);
