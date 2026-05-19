"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const SERVER_TYPES = ["VANILLA", "PAPER", "PURPUR", "FABRIC", "FORGE", "NEOFORGE"];
const VERSIONS = ["1.21.1", "1.20.4", "1.20.1", "1.19.4"];

export default function NewServerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    serverType: "PAPER",
    minecraftVersion: "1.21.1",
    ramMb: 2048,
    port: 25565,
    javaVersion: "21",
    runtimeMode: "NATIVE",
    autoRestart: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { server } = await api.post<{ server: { id: string } }>("/api/servers", form);
      router.push(`/servers/${server.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold">Create Server</h1>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted">Server Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm text-muted">Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2"
              value={form.serverType}
              onChange={(e) => setForm({ ...form, serverType: e.target.value })}
            >
              {SERVER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted">Version</label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2"
              value={form.minecraftVersion}
              onChange={(e) => setForm({ ...form, minecraftVersion: e.target.value })}
            >
              {VERSIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted">RAM (MB)</label>
              <Input
                type="number"
                value={form.ramMb}
                onChange={(e) => setForm({ ...form, ramMb: parseInt(e.target.value, 10) })}
              />
            </div>
            <div>
              <label className="text-sm text-muted">Port</label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value, 10) })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted">Runtime</label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2"
              value={form.runtimeMode}
              onChange={(e) => setForm({ ...form, runtimeMode: e.target.value })}
            >
              <option value="NATIVE">Native Linux Process</option>
              <option value="DOCKER">Docker Container</option>
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Server"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
