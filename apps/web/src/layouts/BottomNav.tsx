import { NavLink } from "react-router-dom";
import type { NavItem } from "./navConfig";

export function BottomNav({ items }: { items: NavItem[] }) {
  const mobileItems = items.filter((item) => item.mobile).slice(0, 4);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navigasi utama"
    >
      {mobileItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              isActive ? "text-primary" : "text-neutral-500"
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
