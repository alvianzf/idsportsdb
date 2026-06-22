import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { NavItem } from "./navConfig";

const NAVBAR_RED = "#990000";
const SIDEBAR_NAV_BG = "#b01020";
const SIDEBAR_ACTIVE = "rgba(255,255,255,0.18)";
const SIDEBAR_HOVER = "rgba(255,255,255,0.10)";

export function Sidebar({ items }: { items: NavItem[] }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);

  return (
    <aside
      className="flex h-full flex-col transition-all duration-200"
      style={{ width: collapsed ? 56 : 240, background: SIDEBAR_NAV_BG }}
    >
      {/* Brand header */}
      <div
        className="flex h-16 items-center gap-2 px-3"
        style={{ background: NAVBAR_RED, borderBottom: "1px solid rgba(255,255,255,0.12)" }}
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
            className={`block rounded-md`}
            style={({ isActive }) => ({
              background: isActive ? SIDEBAR_ACTIVE : "transparent",
              color: isActive ? "#ffffff" : "rgba(255,255,255,0.75)",
            })}
          >
            {({ isActive }) => (
              <motion.span
                className={`flex items-center rounded-md ${collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"}`}
                whileHover={{
                  x: 4,
                  backgroundColor: isActive ? SIDEBAR_ACTIVE : SIDEBAR_HOVER,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              >
                <Icon size={18} />
                {!collapsed && <span className="text-sm font-medium">{label}</span>}
              </motion.span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <motion.button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
        whileHover={{ color: "#ffffff" }}
        transition={{ duration: 0.15 }}
        title={collapsed ? "Perluas sidebar" : "Perkecil sidebar"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </motion.button>
    </aside>
  );
}
