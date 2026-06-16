import { NavLink } from "react-router-dom";
import type { NavItem } from "./navConfig";

export function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-neutral-200 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
          K
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">KONI Batam</p>
          <p className="text-xs text-neutral-500 leading-tight">Sistem Atlet</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
