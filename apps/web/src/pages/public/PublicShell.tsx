import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import { PUBLIC_NAV } from "./publicNav";

/** Shared header/footer shell for public (no-auth) pages. Revisi 2026-07-12. */
export function PublicShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-svh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-semibold leading-tight text-neutral-900">KONI Batam</p>
              <p className="text-xs leading-tight text-neutral-500">Sistem Informasi Manajemen Atlet</p>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 font-medium transition-colors ${
                    isActive ? "bg-primary-50 text-primary" : "text-neutral-600 hover:text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <Link to={user.role === "ATLET" ? "/me" : "/dashboard"} className="ml-2">
                <Button>Dashboard</Button>
              </Link>
            ) : (
              <Link to="/login" className="ml-2">
                <Button>Masuk</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
