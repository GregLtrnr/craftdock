"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Package,
  Settings,
  LogOut,
  Shield,
  Blocks,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: "/dashboard" },
  { href: "/modpacks", label: "Modpacks", icon: Package, match: "/modpacks" },
];

const hostLinks = [
  { href: "/servers/new", label: "New server", icon: Server, match: "/servers/new" },
];

const bottomLinks = [
  { href: "/settings", label: "Settings", icon: Settings, match: "/settings" },
  { href: "/admin", label: "Admin", icon: Shield, match: "/admin", adminOnly: true },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-primary text-black shadow-sm"
          : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-black")} />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (match: string) =>
    pathname === match || (match !== "/dashboard" && pathname.startsWith(match + "/"));

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <aside
      className="flex h-screen w-[260px] shrink-0 flex-col border-r border-border px-4 py-5"
      style={{ background: "var(--sidebar-gradient)" }}
    >
      <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md">
          <Blocks className="h-5 w-5 text-black" />
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight">CraftDock</span>
          <p className="text-[11px] font-medium text-muted">Minecraft hosting</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Overview
          </p>
          <div className="space-y-1">
            {mainLinks.map((l) => (
              <NavLink key={l.href} {...l} active={isActive(l.match)} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Hosting
          </p>
          <div className="space-y-1">
            {hostLinks.map((l) => (
              <NavLink key={l.href} {...l} active={isActive(l.match)} />
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Account
          </p>
          <div className="space-y-1">
            {bottomLinks
              .filter((l) => !l.adminOnly || user?.role === "ADMIN")
              .map((l) => (
                <NavLink key={l.href} {...l} active={isActive(l.match)} />
              ))}
          </div>
        </div>
      </nav>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-muted">Theme</span>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-sm font-bold text-primary">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.email?.split("@")[0] ?? "User"}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
