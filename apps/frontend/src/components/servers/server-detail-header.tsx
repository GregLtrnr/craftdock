"use client";

import { useState } from "react";
import {
  Globe,
  Cpu,
  MemoryStick,
  Users,
  Box,
  Clock,
  Play,
  RotateCw,
  Square,
  Copy,
  Check,
  Trash2,
  Skull,
  FileCheck,
} from "lucide-react";
import type { Server, ServerStats } from "@/lib/api";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/servers/metric-chip";
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function statusLabel(status: string): string {
  if (status === "RUNNING") return "Online";
  if (status === "STOPPED") return "Offline";
  return status;
}

export function ServerDetailHeader({
  server,
  stats,
  connectHost,
  networkWarning,
  onStart,
  onStop,
  onRestart,
  onKill,
  onDelete,
  onEula,
  deleting,
}: {
  server: Server;
  stats: ServerStats | null;
  connectHost: string;
  networkWarning?: string | null;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onKill: () => void;
  onDelete: () => void;
  onEula?: () => void;
  deleting?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const address = connectHost ? `${connectHost}:${server.port}` : `:${server.port}`;
  const isRunning = server.status === "RUNNING";

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-bold tracking-tight lg:text-3xl">
              {server.name}
            </h1>
            <Badge variant={statusToBadgeVariant(server.status)}>
              {isRunning && (
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              )}
              {statusLabel(server.status)}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <MetricChip
              icon={Globe}
              label="Address"
              value={address}
              title="Click copy"
              className="cursor-pointer hover:border-primary/40"
            />
            <button
              type="button"
              onClick={copyAddress}
              className="flex h-[52px] items-center justify-center rounded-lg border border-border/60 bg-background-subtle/80 px-3 text-muted hover:text-primary"
              title="Copy address"
            >
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </button>
            <MetricChip
              icon={Cpu}
              label="CPU"
              value={`${stats?.cpuPercent?.toFixed(1) ?? 0}%`}
            />
            <MetricChip
              icon={MemoryStick}
              label="Memory"
              value={`${stats?.memoryUsedMb ?? 0} / ${server.ramMb} MB`}
            />
            <MetricChip
              icon={Users}
              label="Players"
              value={`${stats?.onlinePlayers ?? 0} / ${server.maxPlayers}`}
            />
            <MetricChip
              icon={Box}
              label="Software"
              value={`${server.serverType} ${server.minecraftVersion}`}
            />
            <MetricChip
              icon={Clock}
              label="Uptime"
              value={formatUptime(stats?.uptimeSeconds ?? 0)}
            />
          </div>

          {networkWarning && (
            <p className="mt-3 text-xs text-warning">{networkWarning}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onStart}
              disabled={isRunning || server.status === "INSTALLING"}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Start
            </Button>
            <Button variant="secondary" onClick={onRestart} className="gap-2">
              <RotateCw className="h-4 w-4" />
              Restart
            </Button>
            <Button
              variant="danger"
              onClick={onStop}
              disabled={server.status === "STOPPED"}
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </div>
          <div className="flex gap-2">
            {!server.eulaAccepted && onEula && (
              <Button variant="outline" size="sm" onClick={onEula} className="gap-1.5">
                <FileCheck className="h-3.5 w-3.5" />
                EULA
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onKill} className="gap-1.5 text-warning">
              <Skull className="h-3.5 w-3.5" />
              Kill
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
              className="gap-1.5 text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "…" : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
