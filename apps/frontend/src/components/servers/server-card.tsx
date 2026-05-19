"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Cpu, MemoryStick, Users, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
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
}: {
  server: Server;
  stats?: ServerStats;
}) {
  return (
    <Link href={`/servers/${server.id}`}>
      <Card className="cursor-pointer transition-colors hover:border-primary/40">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{server.name}</h3>
            <p className="text-xs text-muted">
              {server.serverType} · {server.minecraftVersion} · :{server.port}
            </p>
          </div>
          <span className={cn("flex items-center gap-1 text-xs font-medium", statusColors[server.status])}>
            <Circle className="h-2 w-2 fill-current" />
            {server.status}
          </span>
        </div>
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
      </Card>
    </Link>
  );
}
