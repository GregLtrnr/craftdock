"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-lg shadow-black/20",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
