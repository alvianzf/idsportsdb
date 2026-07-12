import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, CalendarDays, Home, Newspaper } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Beranda", icon: Home, end: true },
  { to: "/data", label: "Data", icon: BarChart3, end: false },
  { to: "/berita", label: "Berita", icon: Newspaper, end: false },
  { to: "/event", label: "Kalender", icon: CalendarDays, end: false },
];

/** Mobile bottom navigation for public pages — same glass style as the
 * dashboard BottomNav. Hidden on md+ where the header menu shows. */
export function PublicBottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-white/30 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      style={{ background: "rgba(255,248,247,0.82)" }}
      aria-label="Navigasi utama"
    >
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="flex flex-1 flex-col items-center py-2">
          {({ isActive }) => (
            <motion.span
              className="flex flex-col items-center gap-0.5"
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  isActive ? "bg-primary-container" : ""
                }`}
              >
                <Icon
                  size={22}
                  className={isActive ? "text-on-primary-container" : "text-on-surface-variant"}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </span>
              <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-on-surface-variant"}`}>
                {label}
              </span>
            </motion.span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
