import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@inasportdb/shared-types";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role: Role;
  cabangOlahragaId?: string | null;
  athleteId?: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

// The refresh token is NOT stored here — it lives in an httpOnly cookie set by
// the API so JS/XSS can't read it (issue #4). Only the short-lived access token
// and the user object are persisted.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    { name: "koni-auth" },
  ),
);
