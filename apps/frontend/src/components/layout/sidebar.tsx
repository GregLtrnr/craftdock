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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/servers/new", label: "Create Server", icon: Server },
  { href: "/modpacks", label: "Modpacks", icon: Package },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card/50 p-4">
      <div className="mb-8 px-2">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-black">
            C
          </div>
          <span className="text-xl font-bold tracking-tight">CraftDock</span>
        </Link>
        <p className="mt-1 text-xs text-muted">Minecraft Hosting Panel</p>
      </div>

      <nav className="flex-1 space-y-1">
        {links
          .filter((l) => !l.adminOnly || user?.role === "ADMIN")
          .map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-card-hover hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
      </nav>

      <div className="border-t border-border pt-4">
        <p className="truncate px-2 text-xs text-muted">{user?.email}</p>
        <Button variant="ghost" className="mt-2 w-full justify-start gap-2" onClick={() => logout()}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
