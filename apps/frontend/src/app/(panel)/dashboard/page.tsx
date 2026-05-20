"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Server,
  PlayCircle,
  PauseCircle,
  Users,
  AlertTriangle,
} from "lucide-react";
import { api, type Server as ServerType, type ServerStats } from "@/lib/api";
import { ServerCard } from "@/components/servers/server-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterStatus = "ALL" | "RUNNING" | "STOPPED" | "CRASHED" | "OTHER";

const filters: { id: FilterStatus; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "RUNNING", label: "Running" },
  { id: "STOPPED", label: "Stopped" },
  { id: "CRASHED", label: "Crashed" },
  { id: "OTHER", label: "Other" },
];

export default function DashboardPage() {
  const [servers, setServers] = useState<ServerType[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ServerStats>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("ALL");

  const loadServers = async () => {
    const { servers: list } = await api.get<{ servers: ServerType[] }>("/api/servers");
    setServers(list);
    const stats: Record<string, ServerStats> = {};
    await Promise.all(
      list.map(async (s) => {
        try {
          const { stats: st } = await api.get<{ stats: ServerStats }>(
            `/api/servers/${s.id}/stats`
          );
          stats[s.id] = st;
        } catch {
          /* ignore */
        }
      })
    );
    setStatsMap(stats);
  };

  useEffect(() => {
    loadServers()
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
    const interval = setInterval(loadServers, 8000);
    return () => clearInterval(interval);
  }, []);

  const deleteServer = async (server: ServerType) => {
    if (
      !confirm(
        `Delete "${server.name}"? All files will be removed. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/api/servers/${server.id}`);
      await loadServers();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const summary = useMemo(() => {
    const running = servers.filter((s) => s.status === "RUNNING").length;
    const stopped = servers.filter((s) => s.status === "STOPPED").length;
    const crashed = servers.filter((s) => s.status === "CRASHED").length;
    const players = servers.reduce(
      (acc, s) => acc + (statsMap[s.id]?.onlinePlayers ?? 0),
      0
    );
    return { running, stopped, crashed, players, total: servers.length };
  }, [servers, statsMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.serverType.toLowerCase().includes(q) ||
        String(s.port).includes(q);
      const matchFilter =
        filter === "ALL" ||
        (filter === "RUNNING" && s.status === "RUNNING") ||
        (filter === "STOPPED" && s.status === "STOPPED") ||
        (filter === "CRASHED" && s.status === "CRASHED") ||
        (filter === "OTHER" &&
          !["RUNNING", "STOPPED", "CRASHED"].includes(s.status));
      return matchSearch && matchFilter;
    });
  }, [servers, search, filter]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Overview</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight lg:text-4xl">Dashboard</h1>
          <p className="mt-2 max-w-lg text-muted">
            Manage your Minecraft servers, monitor resources, and launch new instances.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/modpacks">
            <Button variant="secondary">Browse modpacks</Button>
          </Link>
          <Link href="/servers/new">
            <Button className="gap-2 shadow-md">
              <Plus className="h-4 w-4" />
              New server
            </Button>
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total servers"
          value={summary.total}
          sub="Instances on this node"
          icon={Server}
        />
        <StatCard
          label="Running"
          value={summary.running}
          sub={`${summary.stopped} stopped`}
          icon={PlayCircle}
          accent="success"
        />
        <StatCard
          label="Players online"
          value={summary.players}
          sub="Across all running servers"
          icon={Users}
          accent="default"
        />
        <StatCard
          label="Needs attention"
          value={summary.crashed}
          sub="Crashed or failed install"
          icon={summary.crashed > 0 ? AlertTriangle : PauseCircle}
          accent={summary.crashed > 0 ? "danger" : "default"}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search by name, type, or port…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.id
                    ? "bg-primary text-black"
                    : "bg-background-subtle text-muted hover:bg-card-hover hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-border bg-card"
            />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-muted">
            <Server className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">No servers yet</h2>
          <p className="mt-2 max-w-sm text-muted">
            Create a vanilla server or install a modpack from Modrinth to get started.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/servers/new">
              <Button>New server</Button>
            </Link>
            <Link href="/modpacks">
              <Button variant="secondary">Install modpack</Button>
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted">No servers match your search or filter.</p>
      ) : (
        <motion.div
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {filtered.map((server) => (
            <motion.div
              key={server.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <ServerCard
                server={server}
                stats={statsMap[server.id]}
                onDelete={deleteServer}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
