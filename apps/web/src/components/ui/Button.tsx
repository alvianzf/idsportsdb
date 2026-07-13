import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:   "bg-primary text-white shadow-sm hover:shadow-md hover:bg-primary-600 active:shadow-sm",
  secondary: "bg-primary-container text-on-primary-container hover:bg-primary-200/70",
  outline:   "border border-outline text-primary bg-transparent hover:bg-primary-50/60",
  ghost:     "text-primary bg-transparent hover:bg-primary-50/60",
  danger:    "bg-danger text-white shadow-sm hover:bg-danger/85",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
