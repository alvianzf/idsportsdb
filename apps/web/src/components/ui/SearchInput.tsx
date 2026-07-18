import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "./Field";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired on Enter — applies whatever is typed in the input (skip any debounce). */
  onSubmit?: () => void;
  /** Autocomplete suggestions, usually names from the loaded rows. */
  suggestions?: string[];
  placeholder?: string;
  /** Hide the leading search icon (e.g. when used as a plain form field). */
  showIcon?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * Search input with a select-style suggestion dropdown (revisi 2026-07-18):
 * matching options open below the input like a Select and are picked by click.
 * Enter always submits the typed text as-is — never a suggestion.
 */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  suggestions = [],
  placeholder = "Cari...",
  showIcon = true,
  required = false,
  id,
  className = "",
}: SearchInputProps) {
  const [open, setOpen] = useState(false);
  // Distinguish "user typed" from "user picked": picking closes the dropdown
  // and must not reopen it via the controlled-value change.
  const pickedRef = useRef(false);

  const options = useMemo(() => {
    const q = value.trim().toLowerCase();
    return [...new Set(suggestions.filter(Boolean))]
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, value]);

  const showDropdown = open && value.trim() !== "" && options.length > 0;

  function pick(option: string) {
    pickedRef.current = true;
    onChange(option);
    setOpen(false);
    onSubmit?.();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      // Enter submits exactly what is typed — suggestions are click-only.
      e.preventDefault();
      setOpen(false);
      onSubmit?.();
    }
  }

  return (
    <div className={`relative ${className}`}>
      {showIcon && (
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" />
      )}
      <Input
        id={id}
        type="search"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (pickedRef.current) {
            pickedRef.current = false;
            return;
          }
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so an option click (mousedown) lands before the list closes.
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className={showIcon ? "pl-9" : ""}
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {options.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
