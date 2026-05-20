"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  hover = false,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        hover && "transition-shadow hover:border-border-strong hover:shadow-[var(--shadow-elevated)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
