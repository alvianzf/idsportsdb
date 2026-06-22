import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

const triggerBase =
  "w-full rounded-2xl border border-outline-variant bg-white/60 px-4 py-2.5 text-sm backdrop-blur-sm transition-colors focus:border-primary focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  className = "",
  id,
  required,
  disabled,
}: ComboboxProps) {
  options = options ?? [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setHighlighted(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function select(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlighted];
      if (opt) select(opt);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden native input for form validation */}
      {required && (
        <input
          type="text"
          id={id}
          required={required}
          value={value}
          onChange={() => undefined}
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        className={`${triggerBase} flex items-center justify-between gap-2 text-left ${!selected ? "text-on-surface-variant" : "text-on-surface"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-white/50 bg-white/85 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-outline-variant/40 px-3 py-2.5">
            <Search size={14} className="shrink-0 text-on-surface-variant" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cari..."
              className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60"
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-on-surface-variant">Tidak ada pilihan</li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(opt);
                  }}
                  className={`mx-1.5 cursor-pointer rounded-xl px-3 py-2 text-sm transition-colors ${
                    i === highlighted
                      ? "bg-primary-50/80 text-primary"
                      : "text-on-surface hover:bg-surface-container"
                  } ${opt.value === value ? "font-medium" : ""}`}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
