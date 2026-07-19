import { useEffect, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import { PUBLIC_NAV } from "./publicNav";
import { PublicBottomNav } from "./PublicBottomNav";
import { pageTitle } from "../../lib/site";

/** Shared header/footer shell for public (no-auth) pages. Revisi 2026-07-12. */
export function PublicShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-svh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-semibold leading-tight text-neutral-900">KONI Batam</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {PUBLIC_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 font-medium transition-colors ${
                      isActive ? "bg-primary-50 text-primary" : "text-neutral-600 hover:text-primary"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {user ? (
              <Link to={user.role === "ATLET" ? "/me" : "/dashboard"} className="md:ml-2">
                <Button>Dashboard</Button>
              </Link>
            ) : (
              <Link to="/login" className="md:ml-2">
                <Button>Masuk</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-8">
        <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        <div className="mt-6">{children}</div>
      </main>

      <PublicBottomNav />
    </div>
  );
}
