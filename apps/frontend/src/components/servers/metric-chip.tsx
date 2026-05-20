import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricChip({
  icon: Icon,
  label,
  value,
  className,
  title,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/60 bg-background-subtle/80 px-3 py-2",
        className
      )}
      title={title}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate font-mono text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
