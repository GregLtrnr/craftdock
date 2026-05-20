"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

const ResourceChart = dynamic(
  () => import("@/components/charts/resource-chart").then((m) => m.ResourceChart),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-lg bg-card" /> }
);

export default function AdminPage() {
  const [metrics, setMetrics] = useState<{
    cpu: { usage: number };
    memory: { used: number; total: number };
  } | null>(null);
  const [chart, setChart] = useState<{ time: string; value: number }[]>([]);

  useEffect(() => {
    const load = () =>
      api
        .get<{ metrics: { cpu: { usage: number }; memory: { used: number; total: number } } }>(
          "/api/system/metrics"
        )
        .then(({ metrics: m }) => {
          setMetrics(m);
          setChart((prev) => [
            ...prev.slice(-19),
            {
              time: new Date().toLocaleTimeString(),
              value: Math.round((m.memory.used / m.memory.total) * 100),
            },
          ]);
        })
        .catch(() => undefined);
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold">System Admin</h1>
      <p className="text-muted">Host node metrics and health</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">CPU</p>
          <p className="text-2xl font-bold">{metrics?.cpu.usage.toFixed(1) ?? 0}%</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Memory</p>
          <p className="text-2xl font-bold">
            {metrics
              ? `${Math.round(metrics.memory.used / 1024 / 1024 / 1024)} / ${Math.round(metrics.memory.total / 1024 / 1024 / 1024)} GB`
              : "—"}
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <ResourceChart data={chart} dataKey="mem" label="System memory %" color="#3b82f6" />
      </Card>
    </div>
  );
}
