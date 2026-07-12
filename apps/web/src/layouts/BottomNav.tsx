import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import type { NavItem } from "./navConfig";

export function BottomNav({ items }: { items: NavItem[] }) {
  const mobileItems = items.filter((item) => item.mobile);
  const centerItem = mobileItems.find((item) => item.center);
  const sideItems = mobileItems.filter((item) => !item.center).slice(0, 4);
  const leftItems = sideItems.slice(0, 2);
  const rightItems = sideItems.slice(2, 4);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex items-end border-t border-white/30 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      style={{ background: "rgba(255,248,247,0.82)" }}
      aria-label="Navigasi utama"
    >
      {leftItems.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className="flex flex-1 flex-col items-center py-2">
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

      {centerItem && (() => {
        const { to, label, icon: Icon } = centerItem;
        return (
          <NavLink to={to} className="relative -top-4 mx-4 flex flex-col items-center gap-1">
            {({ isActive }) => (
              <>
                <motion.span
                  className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg text-white backdrop-blur-sm ${
                    isActive ? "bg-primary-700" : "bg-primary"
                  }`}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.06 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                >
                  <Icon size={26} />
                </motion.span>
                <span className="text-xs font-medium text-on-surface-variant">{label}</span>
              </>
            )}
          </NavLink>
        );
      })()}

      {rightItems.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className="flex flex-1 flex-col items-center py-2">
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
