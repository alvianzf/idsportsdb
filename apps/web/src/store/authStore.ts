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
// the API so JS/XSS can't read it (issue #4). The access token stays in-memory
// only (not persisted) so an XSS payload can't read it out of localStorage;
// only the user object is persisted, so the UI still renders immediately on
// reload while bootstrapAuth() silently exchanges the refresh cookie for a
// fresh access token (see lib/api.ts).
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    { name: "koni-auth", partialize: (state) => ({ user: state.user }) },
  ),
);
