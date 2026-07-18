import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, type LucideIcon } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Renders the item in danger (red) styling. */
  danger?: boolean;
  className?: string;
}

/**
 * Kebab (three-dots) button revealing a dropdown of row actions (revisi
 * 2026-07-18). The menu renders in a portal with fixed positioning so it is
 * never clipped by an overflow container (e.g. DataTable's horizontal scroll).
 */
export function ActionMenu({ items, label = "Aksi" }: { items: ActionMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // The menu is fixed-positioned, so any scroll/resize would detach it from
    // the button — just close it.
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 w-48 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
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
          </div>,
          document.body,
        )}
    </>
  );
}
