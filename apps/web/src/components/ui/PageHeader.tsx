import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mb-5 flex flex-col gap-2 md:mb-7 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <div className="mb-1.5 h-1 w-10 rounded-full bg-gradient-to-r from-[#990000] to-[#d92626]" />
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </motion.div>
  );
}
