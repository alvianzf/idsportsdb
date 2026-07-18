import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { logout } from "../lib/api";
import type { NavItem } from "./navConfig";

export function Sidebar({ items }: { items: NavItem[] }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);

  return (
    <aside
      className="flex h-full flex-col border-r border-white/15 backdrop-blur-2xl transition-all duration-200"
      style={{
        width: collapsed ? 56 : 240,
        // Match the landing hero gradient (revisi 2026-07-12).
        background: "linear-gradient(180deg, #5c0000 0%, #990000 55%, #b81c1c 100%)",
      }}
    >
      {/* Brand header */}
      <div
        className="flex h-16 items-center gap-2 px-3 border-b border-white/15"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-8 w-8 shrink-0 object-contain" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-white">KONI Batam</p>
            <p className="truncate text-xs leading-tight text-white/60">Sistem Atlet</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className="block"
          >
            {({ isActive }) => (
              <motion.span
                className={`flex items-center rounded-full transition-colors ${
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-4 py-2.5"
                } ${
                  isActive
                    ? "bg-white/20 text-white shadow-inner"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                whileHover={{ x: collapsed ? 0 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                {!collapsed && (
                  <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                    {label}
                  </span>
                )}
              </motion.span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout (revisi 2026-07-18) */}
      <button
        type="button"
        onClick={() => void logout()}
        title="Keluar"
        className={`flex items-center border-t border-white/15 py-3 text-white/70 transition-colors hover:bg-white/10 hover:text-white ${
          collapsed ? "justify-center" : "gap-3 px-6"
        }`}
      >
        <LogOut size={18} strokeWidth={1.8} />
        {!collapsed && <span className="text-sm font-medium">Keluar</span>}
      </button>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center py-3 text-white/50 transition-colors hover:text-white border-t border-white/15"
        title={collapsed ? "Perluas sidebar" : "Perkecil sidebar"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
