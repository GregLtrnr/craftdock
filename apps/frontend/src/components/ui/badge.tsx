import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary-muted text-primary",
        running: "bg-success-muted text-success",
        stopped: "bg-card-hover text-muted border border-border",
        warning: "bg-warning-muted text-warning",
        danger: "bg-danger-muted text-danger",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  children,
}: {
  className?: string;
  children: React.ReactNode;
} & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}

export function statusToBadgeVariant(
  status: string
): VariantProps<typeof badgeVariants>["variant"] {
  switch (status) {
    case "RUNNING":
      return "running";
    case "STOPPED":
      return "stopped";
    case "CRASHED":
      return "danger";
    case "STARTING":
    case "STOPPING":
    case "INSTALLING":
      return "warning";
    default:
      return "outline";
  }
}
