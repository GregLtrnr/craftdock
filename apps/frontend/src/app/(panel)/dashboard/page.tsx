"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Link from "next/link";
import { api, type Server, type ServerStats } from "@/lib/api";
import { ServerCard } from "@/components/servers/server-card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ServerStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ servers: Server[] }>("/api/servers")
      .then(async ({ servers }) => {
        setServers(servers);
        const stats: Record<string, ServerStats> = {};
        await Promise.all(
          servers.map(async (s) => {
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
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Servers</h1>
          <p className="text-muted">Manage your Minecraft instances</p>
        </div>
        <Link href="/servers/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Server
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="mt-8 text-muted">Loading servers...</p>
      ) : servers.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-muted">No servers yet. Create your first one!</p>
          <Link href="/servers/new">
            <Button className="mt-4">Create Server</Button>
          </Link>
        </div>
      ) : (
        <motion.div
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} stats={statsMap[server.id]} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
