import { Outlet, Navigate, Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { navItemsForRole } from "./navConfig";
import { useAuthStore } from "../store/authStore";

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const items = navItemsForRole(user.role);

  return (
    <div className="flex min-h-svh bg-neutral-50">
      <Sidebar items={items} />

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 pt-[env(safe-area-inset-top)] md:h-16 md:px-6 md:pt-0">
          <div className="flex items-center gap-2 md:hidden">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold">KONI Batam</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <Link to="/settings/profile" className="text-right hover:opacity-70 transition-opacity">
              <p className="text-sm font-medium leading-tight">{user.fullName}</p>
              <p className="text-xs text-neutral-500 leading-tight">
                {user.role.replace(/_/g, " ")}
              </p>
            </Link>
            <button
              onClick={logout}
              aria-label="Keluar"
              className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-primary"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          <Outlet />
        </main>

        <BottomNav items={items} />
      </div>
    </div>
  );
}
