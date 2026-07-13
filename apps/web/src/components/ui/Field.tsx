import { useState } from "react";
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { Combobox, type ComboboxOption } from "./Combobox";

const fieldClasses =
  "w-full rounded-2xl border border-outline-variant bg-white/60 px-4 py-2.5 text-sm backdrop-blur-sm transition-colors focus:border-primary focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-100/50 disabled:text-neutral-400";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClasses} ${className}`} {...props} />;
}

/** Password input with a reveal/hide toggle (client note 2026-07-12). */
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={`${fieldClasses} pr-11 ${className}`} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-700"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClasses} min-h-24 ${className}`} {...props} />;
}

// Select — searchable dropdown backed by Combobox. Replaces native <select>.
interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

export function Select({ value, onChange, options, placeholder, className = "", id, required, disabled }: SelectProps) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      id={id}
      required={required}
      disabled={disabled}
    />
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, required, error, hint, children, htmlFor }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-on-surface">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
