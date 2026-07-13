import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { navItemsForRole } from "./navConfig";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ProfileModal } from "../components/ProfileModal";
import { resolveFileUrl } from "../lib/api";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useAuthStore } from "../store/authStore";

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useDocumentTitle();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const items = navItemsForRole(user.role);

  return (
    <div className="flex min-h-svh">
      <div className="sticky top-0 hidden h-svh shrink-0 md:block">
        <Sidebar items={items} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-white/20 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:h-16 md:px-6 md:pt-0"
          style={{ background: "linear-gradient(90deg, #990000 0%, #d92626 100%)" }}
        >
          <div className="flex items-center gap-2 md:hidden">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold text-white">KONI Batam</span>
          </div>
          <div className="hidden md:block" />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-right transition-colors hover:bg-white/10"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {user.avatarUrl ? (
                <img
                  src={resolveFileUrl(user.avatarUrl)}
                  alt=""
                  className="h-9 w-9 rounded-full border border-white/40 object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                  {user.fullName.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden sm:block">
                <span className="block text-sm font-medium leading-tight text-white">{user.fullName}</span>
                <span className="block text-xs leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {user.role.replace(/_/g, " ")}
                </span>
              </span>
              <ChevronDown
                size={15}
                className={`text-white/75 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1.5 shadow-xl">
                  <button
                    onClick={() => { setMenuOpen(false); setShowProfile(true); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    <UserRound size={15} className="text-neutral-400" /> Edit Profil
                  </button>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-danger transition-colors hover:bg-neutral-50"
                  >
                    <LogOut size={15} /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          <Breadcrumbs homeTo={user.role === "ATLET" ? "/me" : "/dashboard"} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <BottomNav items={items} />
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
