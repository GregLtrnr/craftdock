"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return <div className={cn("h-9 w-16 rounded-full bg-card", className)} />;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative flex h-9 w-16 items-center rounded-full border border-border bg-card p-1 transition-colors hover:bg-card-hover",
        className
      )}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span
        className={cn(
          "absolute h-7 w-7 rounded-full bg-primary shadow-sm transition-transform duration-200",
          theme === "dark" ? "translate-x-0" : "translate-x-7"
        )}
      />
      <Sun
        className={cn(
          "relative z-10 ml-1.5 h-4 w-4 transition-colors",
          theme === "light" ? "text-black" : "text-muted"
        )}
      />
      <Moon
        className={cn(
          "relative z-10 ml-auto mr-1.5 h-4 w-4 transition-colors",
          theme === "dark" ? "text-black" : "text-muted"
        )}
      />
    </button>
  );
}
