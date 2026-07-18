import { useId, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "./Field";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired on Enter — use to apply the search immediately (skip any debounce). */
  onSubmit?: () => void;
  /** Autocomplete suggestions, usually names from the currently loaded rows. */
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

/**
 * Search input with a leading icon, native autocomplete via <datalist>, and
 * Enter-to-apply (revisi 2026-07-18). Suggestions are deduped and capped so the
 * dropdown stays scannable.
 */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  suggestions = [],
  placeholder = "Cari...",
  className = "",
}: SearchInputProps) {
  const listId = useId();
  const options = [...new Set(suggestions.filter(Boolean))].slice(0, 20);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" />
      <Input
        type="search"
        list={options.length > 0 ? listId : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="pl-9"
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
