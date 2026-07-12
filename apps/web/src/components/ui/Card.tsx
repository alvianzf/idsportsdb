import type { HTMLAttributes } from "react";
import { motion } from "framer-motion";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function Card({ className = "", hoverable = false, ...props }: CardProps) {
  const base = `rounded-3xl border border-white/50 bg-white/60 backdrop-blur-md p-4 md:p-6 shadow-sm ${className}`;

  if (hoverable) {
    return (
      <motion.div
        className={base}
        whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(200,16,46,0.10)" }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        {...(props as React.ComponentProps<typeof motion.div>)}
      />
    );
  }

  return <div className={base} {...props} />;
}
