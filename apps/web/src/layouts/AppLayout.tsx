import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { navItemsForRole } from "./navConfig";
import { useAuthStore } from "../store/authStore";

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const items = navItemsForRole(user.role);

  return (
    <div className="flex min-h-svh bg-neutral-50">
      {/* Sidebar sticks to the left viewport edge and doesn't scroll */}
      <div className="sticky top-0 hidden h-svh shrink-0 md:block">
        <Sidebar items={items} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex min-h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)] md:h-16 md:px-6 md:pt-0"
          style={{ background: "#990000" }}
        >
          <div className="flex items-center gap-2 md:hidden">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold text-white">KONI Batam</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <Link
              to="/settings/profile"
              className="text-right transition-opacity hover:opacity-80"
            >
              <p className="text-sm font-medium leading-tight text-white">{user.fullName}</p>
              <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>
                {user.role.replace(/_/g, " ")}
              </p>
            </Link>
            <button
              onClick={logout}
              aria-label="Keluar"
              className="rounded-md p-2 transition-colors"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
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
    </div>
  );
}
