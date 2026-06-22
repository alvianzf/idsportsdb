import type { HTMLAttributes } from "react";
import { motion } from "framer-motion";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function Card({ className = "", hoverable = false, ...props }: CardProps) {
  const base = `rounded-lg border border-neutral-200 bg-white p-4 md:p-6 ${className}`;

  if (hoverable) {
    return (
      <motion.div
        className={base}
        whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.09)" }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        {...(props as React.ComponentProps<typeof motion.div>)}
      />
    );
  }

  return <div className={base} {...props} />;
}
