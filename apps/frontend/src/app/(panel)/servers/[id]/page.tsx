"use client";

import dynamic from "next/dynamic";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, type Server, type ServerStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ServerDetailHeader } from "@/components/servers/server-detail-header";
import { cn } from "@/lib/utils";

const ServerTerminal = dynamic(
  () => import("@/components/console/terminal").then((m) => m.ServerTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-border bg-background text-sm text-muted">
        Loading console…
      </div>
    ),
  },
);

const ResourceChart = dynamic(
  () =>
    import("@/components/charts/resource-chart").then((m) => m.ResourceChart),
  {
    ssr: false,
    loading: () => <div className="h-36 animate-pulse rounded-xl bg-card" />,
  },
);

type Tab = "console" | "files" | "players" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "console", label: "Console" },
  { id: "files", label: "Files" },
  { id: "players", label: "Players" },
  { id: "settings", label: "Properties" },
];

export default function ServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [server, setServer] = useState<Server | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [tab, setTab] = useState<Tab>("console");
  const [ramChart, setRamChart] = useState<{ time: string; value: number }[]>([]);
  const [cpuChart, setCpuChart] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [installLogs, setInstallLogs] = useState<
    { level: string; message: string; createdAt: string }[]
  >([]);
  const [connectHost, setConnectHost] = useState("");
  const [network, setNetwork] = useState<{
    listening: boolean;
    propertiesPort: number | null;
    propertiesServerIp: string | null;
    issues: string[];
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setConnectHost(window.location.hostname);
    }
  }, []);

  const load = async () => {
    const { server: s } = await api.get<{ server: Server }>(
      `/api/servers/${id}`,
    );
    setServer(s);
    if (s.status === "INSTALLING" || s.status === "CRASHED") {
      try {
        const { logs } = await api.get<{
          logs: { level: string; message: string; createdAt: string }[];
        }>(`/api/servers/${id}/logs`);
        setInstallLogs(logs);
      } catch {
        setInstallLogs([]);
      }
    }
    const { stats: st } = await api.get<{ stats: ServerStats }>(
      `/api/servers/${id}/stats`,
    );
    setStats(st);
    const t = new Date().toLocaleTimeString();
    setRamChart((prev) => [...prev.slice(-19), { time: t, value: st.memoryUsedMb }]);
    setCpuChart((prev) => [...prev.slice(-19), { time: t, value: st.cpuPercent }]);
    if (s.status === "RUNNING" || s.status === "STOPPED") {
      try {
        const { network: nw } = await api.get<{
          network: {
            listening: boolean;
            propertiesPort: number | null;
            propertiesServerIp: string | null;
            issues: string[];
          };
        }>(`/api/servers/${id}/network`);
        setNetwork(nw);
      } catch {
        setNetwork(null);
      }
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const networkWarning = useMemo(() => {
    if (!network) return null;
    const parts: string[] = [];
    if (!network.listening && server?.status === "RUNNING") {
      parts.push("Port not accepting connections");
    }
    if (
      network.propertiesPort != null &&
      server &&
      network.propertiesPort !== server.port
    ) {
      parts.push(`server.properties port is ${network.propertiesPort}`);
    }
    if (
      network.propertiesServerIp &&
      network.propertiesServerIp !== "" &&
      network.propertiesServerIp !== "0.0.0.0"
    ) {
      parts.push(`server-ip=${network.propertiesServerIp} blocks LAN`);
    }
    if (network.issues.length) parts.push(...network.issues);
    return parts.length ? parts.join(" · ") : null;
  }, [network, server]);

  const action = async (path: string) => {
    await api.post(`/api/servers/${id}/${path}`);
    await load();
  };

  const deleteServer = async () => {
    if (
      !confirm(
        `Delete "${server?.name}"? This removes all server files and cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/servers/${id}`);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
      setDeleting(false);
    }
  };

  if (loading || !server) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <ServerDetailHeader
        server={server}
        stats={stats}
        connectHost={connectHost}
        networkWarning={networkWarning}
        onStart={() => action("start")}
        onStop={() => action("stop")}
        onRestart={() => action("restart")}
        onKill={() => action("kill")}
        onDelete={deleteServer}
        onEula={() => api.post(`/api/servers/${id}/eula`).then(load)}
        deleting={deleting}
      />

      {(server.status === "INSTALLING" || server.status === "CRASHED") &&
        installLogs.length > 0 && (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              server.status === "CRASHED"
                ? "border-danger/40 bg-danger-muted"
                : "border-warning/40 bg-warning-muted"
            )}
          >
            <p className="font-medium">
              {server.status === "CRASHED" ? "Install failed" : "Installing…"}
            </p>
            <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto font-mono text-xs opacity-90">
              {installLogs.slice(-8).map((line, i) => (
                <li key={`${line.createdAt}-${i}`}>{line.message}</li>
              ))}
            </ul>
          </div>
        )}

      <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              tab === t.id
                ? "bg-primary text-black shadow-sm"
                : "text-muted hover:bg-card-hover hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "console" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <ServerTerminal serverId={id} />
          </div>
          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <ResourceChart data={cpuChart} dataKey="cpu" label="CPU usage" />
            </Card>
            <Card className="p-4">
              <ResourceChart data={ramChart} dataKey="ram" label="Memory (MB)" />
            </Card>
          </div>
        </div>
      ) : (
        <div>
          {tab === "files" && <FileManager serverId={id} />}
          {tab === "players" && <PlayerManager serverId={id} />}
          {tab === "settings" && (
            <PropertiesEditor serverId={id} server={server} />
          )}
        </div>
      )}
    </div>
  );
}

function FileManager({ serverId }: { serverId: string }) {
  const [files, setFiles] = useState<
    { name: string; path: string; isDirectory: boolean }[]
  >([]);
  const [path, setPath] = useState(".");

  useEffect(() => {
    api
      .get<{ files: { name: string; path: string; isDirectory: boolean }[] }>(
        `/api/${serverId}/files?path=${encodeURIComponent(path)}`,
      )
      .then((d) => setFiles(d.files))
      .catch(() => setFiles([]));
  }, [serverId, path]);

  return (
    <Card>
      <p className="mb-2 font-mono text-sm text-muted">/{path}</p>
      <ul className="space-y-1 font-mono text-sm">
        {path !== "." && (
          <li>
            <button className="text-primary hover:underline" onClick={() => setPath(".")}>
              ..
            </button>
          </li>
        )}
        {files.map((f) => (
          <li key={f.path}>
            <button
              className="hover:text-primary"
              onClick={() => f.isDirectory && setPath(f.path)}
            >
              {f.isDirectory ? "📁" : "📄"} {f.name}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PlayerManager({ serverId }: { serverId: string }) {
  const [data, setData] = useState<{
    ops: { name: string }[];
    whitelist: { name: string }[];
    bannedPlayers: { name: string }[];
  } | null>(null);
  const [player, setPlayer] = useState("");

  useEffect(() => {
    api
      .get<{
        ops: { name: string }[];
        whitelist: { name: string }[];
        bannedPlayers: { name: string }[];
      }>(`/api/${serverId}/players`)
      .then(setData)
      .catch(() => undefined);
  }, [serverId]);

  return (
    <Card>
      <div className="flex gap-2">
        <input
          className="flex h-11 flex-1 rounded-xl border border-border bg-background-subtle px-4 text-sm"
          placeholder="Player name"
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
        />
        <Button size="sm" onClick={() => api.post(`/api/${serverId}/players/op`, { playerName: player })}>
          OP
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => api.post(`/api/${serverId}/players/ban`, { playerName: player })}
        >
          Ban
        </Button>
      </div>
      {data && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium">Ops</h4>
            <ul className="mt-1 text-muted">
              {data.ops?.map((o) => (
                <li key={o.name}>{o.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium">Whitelist</h4>
            <ul className="mt-1 text-muted">
              {data.whitelist?.map((w) => (
                <li key={w.name}>{w.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium">Banned</h4>
            <ul className="mt-1 text-muted">
              {data.bannedPlayers?.map((b) => (
                <li key={b.name}>{b.name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function PropertiesEditor({
  serverId,
  server,
}: {
  serverId: string;
  server: Server;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [ramMb, setRamMb] = useState(server.ramMb);
  const [savingRam, setSavingRam] = useState(false);

  useEffect(() => {
    api
      .get<{ content: string }>(
        `/api/${serverId}/files/content?path=${encodeURIComponent("server.properties")}`,
      )
      .then((d) => setContent(d.content))
      .catch(() => setContent(""));
  }, [serverId]);

  useEffect(() => {
    setRamMb(server.ramMb);
  }, [server.ramMb]);

  const save = async () => {
    setSaving(true);
    await api.put(`/api/${serverId}/files/content`, {
      path: "server.properties",
      content,
    });
    setSaving(false);
  };

  const applyRam = async () => {
    setSavingRam(true);
    try {
      await api.patch(`/api/servers/${serverId}`, { ramMb });
      alert("RAM updated. Restart server to apply if it is already running.");
    } finally {
      setSavingRam(false);
    }
  };

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="font-semibold">RAM limit</h3>
        <p className="mt-1 text-sm text-muted">
          {Math.floor(ramMb / 1024)} Go ({ramMb} MB) — restart after change
        </p>
        <input
          type="range"
          min={512}
          max={10 * 1024}
          step={256}
          value={ramMb}
          onChange={(e) => setRamMb(parseInt(e.target.value, 10))}
          className="mt-3 w-full"
        />
        <Button
          className="mt-3"
          onClick={applyRam}
          disabled={savingRam || ramMb === server.ramMb}
        >
          {savingRam ? "Saving…" : "Apply RAM"}
        </Button>
      </div>

      <div>
        <h3 className="font-semibold">server.properties</h3>
        <textarea
          className="mt-2 h-64 w-full rounded-xl border border-border bg-background-subtle p-4 font-mono text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button className="mt-3" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
