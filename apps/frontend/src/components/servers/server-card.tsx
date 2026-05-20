"use client";

import Link from "next/link";
import { Cpu, MemoryStick, Users, Circle, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Server, ServerStats } from "@/lib/api";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  RUNNING: "text-primary",
  STOPPED: "text-muted",
  STARTING: "text-warning",
  STOPPING: "text-warning",
  CRASHED: "text-danger",
  INSTALLING: "text-warning",
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
  return (
    <Card className="transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/servers/${server.id}`} className="min-w-0 flex-1">
          <h3 className="font-semibold">{server.name}</h3>
          <p className="text-xs text-muted">
            {server.serverType} · {server.minecraftVersion} · :{server.port}
          </p>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              statusColors[server.status]
            )}
          >
            <Circle className="h-2 w-2 fill-current" />
            {server.status}
          </span>
          {onDelete && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="h-8 w-8 p-0"
              title="Delete server"
              onClick={() => onDelete(server)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <Link href={`/servers/${server.id}`} className="block">
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
          <div className="flex items-center gap-1">
            <MemoryStick className="h-3 w-3" />
            {stats?.memoryUsedMb ?? 0}/{server.ramMb} MB
          </div>
          <div className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            {stats?.cpuPercent?.toFixed(1) ?? 0}%
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {stats?.onlinePlayers ?? 0}/{server.maxPlayers}
          </div>
        </div>
      </Link>
    </Card>
  );
}
