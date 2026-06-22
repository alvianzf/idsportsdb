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
      className="fixed inset-x-0 bottom-0 z-10 flex items-end border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navigasi utama"
    >
      {/* Left items */}
      {leftItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium ${
              isActive ? "text-primary" : "text-neutral-500"
            }`
          }
        >
          {({ isActive }) => (
            <motion.span
              className="flex flex-col items-center gap-0.5"
              whileTap={{ scale: 0.88 }}
              animate={isActive ? { y: -2 } : { y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Icon size={22} />
              {label}
            </motion.span>
          )}
        </NavLink>
      ))}

      {/* Center FAB */}
      {centerItem && (() => {
        const { to, label, icon: Icon } = centerItem;
        return (
          <NavLink
            to={to}
            className="relative -top-4 mx-4 flex flex-col items-center gap-1"
          >
            {({ isActive }) => (
              <>
                <motion.span
                  className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg text-white ${
                    isActive ? "bg-primary-700" : "bg-primary"
                  }`}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                >
                  <Icon size={28} />
                </motion.span>
                <span className="text-xs font-medium text-neutral-500">{label}</span>
              </>
            )}
          </NavLink>
        );
      })()}

      {/* Right items */}
      {rightItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium ${
              isActive ? "text-primary" : "text-neutral-500"
            }`
          }
        >
          {({ isActive }) => (
            <motion.span
              className="flex flex-col items-center gap-0.5"
              whileTap={{ scale: 0.88 }}
              animate={isActive ? { y: -2 } : { y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Icon size={22} />
              {label}
            </motion.span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
