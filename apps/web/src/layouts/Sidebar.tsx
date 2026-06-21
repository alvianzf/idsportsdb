import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NavItem } from "./navConfig";

// Navbar and sidebar brand header use the same red; nav body is slightly lighter
const NAVBAR_RED = "#990000";
const SIDEBAR_NAV_BG = "#b01020"; // lighter than navbar
const SIDEBAR_ACTIVE = "rgba(255,255,255,0.18)";
const SIDEBAR_HOVER = "rgba(255,255,255,0.10)";

export function Sidebar({ items }: { items: NavItem[] }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="hidden shrink-0 flex-col md:flex transition-all duration-200"
      style={{ width: collapsed ? 56 : 240, background: SIDEBAR_NAV_BG }}
    >
      {/* Brand header — same colour as top navbar */}
      <div
        className="flex h-16 items-center gap-2 px-3"
        style={{
          background: NAVBAR_RED,
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-8 w-8 shrink-0 object-contain" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-white">KONI Batam</p>
            <p className="truncate text-xs leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>
              Sistem Atlet
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={() =>
              `flex items-center rounded-md transition-colors ${collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"}`
            }
            style={({ isActive }) => ({
              background: isActive ? SIDEBAR_ACTIVE : "transparent",
              color: isActive ? "#ffffff" : "rgba(255,255,255,0.75)",
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (!(el as HTMLElement).getAttribute("data-active"))
                (el as HTMLElement).style.background = SIDEBAR_HOVER;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (!(el as HTMLElement).getAttribute("data-active"))
                (el as HTMLElement).style.background = "transparent";
            }}
          >
            <Icon size={18} />
            {!collapsed && <span className="text-sm font-medium">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center py-3 transition-colors"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.6)",
        }}
        title={collapsed ? "Perluas sidebar" : "Perkecil sidebar"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
