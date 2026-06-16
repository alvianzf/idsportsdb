import type { HTMLAttributes } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold" | "silver" | "bronze";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
  neutral: "bg-neutral-100 text-neutral-600",
  gold: "bg-gold/15 text-gold",
  silver: "bg-silver/15 text-silver",
  bronze: "bg-bronze/15 text-bronze",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
