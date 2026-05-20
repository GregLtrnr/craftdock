"use client";

import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  MemoryStick,
  Users,
  Trash2,
  Play,
  Square,
} from "lucide-react";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Server, ServerStats } from "@/lib/api";
import { cn } from "@/lib/utils";

const statusBorder: Record<string, string> = {
  RUNNING: "border-l-success",
  STOPPED: "border-l-muted",
  STARTING: "border-l-warning",
  STOPPING: "border-l-warning",
  CRASHED: "border-l-danger",
  INSTALLING: "border-l-warning",
};

export function ServerCard({
  server,
  stats,
  onDelete,
}: {
  server: Server;
  stats?: ServerStats;
  onDelete?: (server: Server) => void;
}) {
  const memPercent = server.ramMb
    ? Math.min(100, Math.round(((stats?.memoryUsedMb ?? 0) / server.ramMb) * 100))
    : 0;
  const isRunning = server.status === "RUNNING";

  return (
    <article
      className={cn(
        "group flex flex-col rounded-2xl border border-border border-l-4 bg-card shadow-[var(--shadow-card)] transition-all hover:border-border-strong hover:shadow-[var(--shadow-elevated)]",
        statusBorder[server.status] ?? "border-l-border"
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/servers/${server.id}`} className="block">
              <h3 className="truncate text-lg font-semibold tracking-tight group-hover:text-primary">
                {server.name}
              </h3>
            </Link>
            <p className="mt-1 text-xs text-muted">
              {server.serverType} · MC {server.minecraftVersion}
            </p>
          </div>
          <Badge variant={statusToBadgeVariant(server.status)}>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isRunning ? "animate-pulse bg-success" : "bg-current"
              )}
            />
            {server.status}
          </Badge>
        </div>

        <div className="mt-4 rounded-xl bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground">
          Port <span className="text-foreground">{server.port}</span>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="flex items-center gap-1 text-muted">
                <MemoryStick className="h-3 w-3" />
                RAM
              </span>
              <span className="font-medium text-foreground">
                {stats?.memoryUsedMb ?? 0} / {server.ramMb} MB
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  memPercent > 85 ? "bg-danger" : memPercent > 60 ? "bg-warning" : "bg-primary"
                )}
                style={{ width: `${memPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background-subtle px-2.5 py-2">
              <Cpu className="h-3.5 w-3.5 text-muted" />
              <span>{stats?.cpuPercent?.toFixed(0) ?? 0}% CPU</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background-subtle px-2.5 py-2">
              <Users className="h-3.5 w-3.5 text-muted" />
              <span>
                {stats?.onlinePlayers ?? 0}/{server.maxPlayers}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <Link href={`/servers/${server.id}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full gap-2">
            {isRunning ? (
              <>
                <Square className="h-3.5 w-3.5" />
                Manage
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Open
              </>
            )}
            <ArrowRight className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </Link>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted hover:text-danger"
            title="Delete server"
            onClick={() => onDelete(server)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </article>
  );
}
