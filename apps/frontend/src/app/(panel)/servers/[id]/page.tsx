"use client";

import dynamic from "next/dynamic";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Server, type ServerStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// xterm.js uses `self` — must not load during SSR
const ServerTerminal = dynamic(
  () => import("@/components/console/terminal").then((m) => m.ServerTerminal),
  { ssr: false, loading: () => <p className="text-sm text-muted">Loading console…</p> }
);

const ResourceChart = dynamic(
  () => import("@/components/charts/resource-chart").then((m) => m.ResourceChart),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-lg bg-card" /> }
);

type Tab = "console" | "files" | "players" | "settings";

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
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [installLogs, setInstallLogs] = useState<
    { level: string; message: string; createdAt: string }[]
  >([]);

  const load = async () => {
    const { server: s } = await api.get<{ server: Server }>(`/api/servers/${id}`);
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
    const { stats: st } = await api.get<{ stats: ServerStats }>(`/api/servers/${id}/stats`);
    setStats(st);
    setChartData((prev) => [
      ...prev.slice(-19),
      { time: new Date().toLocaleTimeString(), value: st.memoryUsedMb },
    ]);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const action = async (path: string) => {
    await api.post(`/api/servers/${id}/${path}`);
    await load();
  };

  const deleteServer = async () => {
    if (
      !confirm(
        `Delete "${server?.name}"? This removes all server files and cannot be undone.`
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
    return <p className="text-muted">Loading server...</p>;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "console", label: "Console" },
    { id: "files", label: "Files" },
    { id: "players", label: "Players" },
    { id: "settings", label: "Properties" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{server.name}</h1>
          <p className="text-muted">
            {server.serverType} {server.minecraftVersion} · Port {server.port} · {server.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => action("start")} disabled={server.status === "RUNNING"}>
            Start
          </Button>
          <Button variant="secondary" onClick={() => action("stop")}>
            Stop
          </Button>
          <Button variant="secondary" onClick={() => action("restart")}>
            Restart
          </Button>
          <Button variant="danger" onClick={() => action("kill")}>
            Kill
          </Button>
          <Button variant="danger" onClick={deleteServer} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
          {!server.eulaAccepted && (
            <Button variant="secondary" onClick={() => api.post(`/api/servers/${id}/eula`)}>
              Accept EULA
            </Button>
          )}
        </div>
      </div>

      {(server.status === "INSTALLING" || server.status === "CRASHED") && installLogs.length > 0 && (
        <Card className="mt-6 border-danger/40">
          <h3 className="font-semibold">
            {server.status === "CRASHED" ? "Install failed" : "Installing…"}
          </h3>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
            {installLogs.map((line, i) => (
              <li
                key={`${line.createdAt}-${i}`}
                className={line.level === "error" ? "text-danger" : "text-muted"}
              >
                {line.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">RAM</p>
          <p className="text-2xl font-bold">
            {stats?.memoryUsedMb ?? 0} / {server.ramMb} MB
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Players</p>
          <p className="text-2xl font-bold">
            {stats?.onlinePlayers ?? 0} / {server.maxPlayers}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Uptime</p>
          <p className="text-2xl font-bold">
            {Math.floor((stats?.uptimeSeconds ?? 0) / 60)}m
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <ResourceChart data={chartData} dataKey="ram" label="Memory usage (MB)" />
      </Card>

      <div className="mt-6 flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "console" && <ServerTerminal serverId={id} />}
        {tab === "files" && <FileManager serverId={id} />}
        {tab === "players" && <PlayerManager serverId={id} />}
        {tab === "settings" && <PropertiesEditor serverId={id} server={server} />}
      </div>
    </div>
  );
}

function FileManager({ serverId }: { serverId: string }) {
  const [files, setFiles] = useState<{ name: string; path: string; isDirectory: boolean }[]>([]);
  const [path, setPath] = useState(".");

  useEffect(() => {
    api
      .get<{ files: { name: string; path: string; isDirectory: boolean }[] }>(
        `/api/${serverId}/files?path=${encodeURIComponent(path)}`
      )
      .then((d) => setFiles(d.files))
      .catch(() => setFiles([]));
  }, [serverId, path]);

  return (
    <Card>
      <p className="mb-2 text-sm text-muted">/{path}</p>
      <ul className="space-y-1 font-mono text-sm">
        {path !== "." && (
          <li>
            <button className="text-primary" onClick={() => setPath(".")}>
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
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="Player name"
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
        />
        <Button size="sm" onClick={() => api.post(`/api/${serverId}/players/op`, { playerName: player })}>
          OP
        </Button>
        <Button size="sm" variant="danger" onClick={() => api.post(`/api/${serverId}/players/ban`, { playerName: player })}>
          Ban
        </Button>
      </div>
      {data && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium">Ops</h4>
            <ul>{data.ops?.map((o) => <li key={o.name}>{o.name}</li>)}</ul>
          </div>
          <div>
            <h4 className="font-medium">Whitelist</h4>
            <ul>{data.whitelist?.map((w) => <li key={w.name}>{w.name}</li>)}</ul>
          </div>
          <div>
            <h4 className="font-medium">Banned</h4>
            <ul>{data.bannedPlayers?.map((b) => <li key={b.name}>{b.name}</li>)}</ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function PropertiesEditor({ serverId, server }: { serverId: string; server: Server }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ content: string }>(
        `/api/${serverId}/files/content?path=${encodeURIComponent("server.properties")}`
      )
      .then((d) => setContent(d.content))
      .catch(() => setContent(""));
  }, [serverId]);

  const save = async () => {
    setSaving(true);
    await api.put(`/api/${serverId}/files/content`, {
      path: "server.properties",
      content,
    });
    setSaving(false);
  };

  return (
    <Card>
      <h3 className="mb-2 font-medium">Storage</h3>
      <p className="mb-4 font-mono text-xs text-muted break-all">
        {server.dataPath ?? "—"}
      </p>
      <p className="mb-4 text-xs text-muted">
        On Docker: volume <code className="text-foreground">craftdock_data</code>, usually{" "}
        <code className="text-foreground">/var/lib/craftdock/servers/&lt;uuid&gt;/</code> inside the
        backend container.
      </p>
      <h3 className="mb-2 font-medium">server.properties</h3>
      <textarea
        className="h-64 w-full rounded border border-border bg-background p-3 font-mono text-sm"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <Button className="mt-2" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </Card>
  );
}
