import type { HTMLAttributes } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold" | "silver" | "bronze";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-light/80 text-success border border-success/20",
  warning: "bg-warning-light/80 text-warning border border-warning/20",
  danger:  "bg-danger-light/80 text-danger border border-danger/20",
  info:    "bg-info-light/80 text-info border border-info/20",
  neutral: "bg-white/50 text-neutral-600 border border-neutral-200/60",
  gold:    "bg-gold/15 text-gold border border-gold/25",
  silver:  "bg-silver/15 text-silver border border-silver/20",
  bronze:  "bg-bronze/15 text-bronze border border-bronze/20",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
