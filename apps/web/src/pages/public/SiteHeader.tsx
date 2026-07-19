import { Link, NavLink } from "react-router-dom";
import { Button } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import { PUBLIC_NAV } from "./publicNav";

/**
 * Shared public header — the landing page version, reused by PublicShell so the
 * navbar is identical on every public page.
 *
 * `containerClass` only controls the inner max-width, so each page can keep the
 * header aligned with its own content column.
 */
export function SiteHeader({ containerClass = "max-w-6xl" }: { containerClass?: string }) {
  const user = useAuthStore((state) => state.user);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
      <div className={`mx-auto flex ${containerClass} flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6`}>
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-sm font-bold leading-tight text-neutral-900">KONI Batam</p>
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
                  `rounded-md px-3 py-1.5 font-semibold transition-colors ${
                    isActive ? "bg-primary-50 text-primary" : "text-neutral-700 hover:bg-primary-50 hover:text-primary"
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
  );
}
