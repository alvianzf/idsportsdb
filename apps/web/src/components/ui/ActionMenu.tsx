import { useEffect, useRef, useState } from "react";
import { MoreVertical, type LucideIcon } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Renders the item in danger (red) styling. */
  danger?: boolean;
  className?: string;
}

/** Kebab (three-dots) button revealing a dropdown of row actions (revisi 2026-07-18). */
export function ActionMenu({ items, label = "Aksi" }: { items: ActionMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              title={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                item.danger ? "text-danger" : "text-neutral-700"
              } ${item.className ?? ""}`}
            >
              <item.icon size={14} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
