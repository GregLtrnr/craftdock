import si from "systeminformation";
import type { ServerStats } from "@craftdock/shared";
import { getRuntime } from "../runtime/runtime-manager";
import { getServer } from "./server.service";

export interface SystemMetrics {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; free: number };
  disk: { total: number; used: number };
  network: { rx: number; tx: number };
  uptime: number;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const [cpu, mem, fsSize, network, time] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.time(),
  ]);

  const disk = fsSize[0];
  const net = network[0];

  return {
    cpu: { usage: cpu.currentLoad ?? 0, cores: cpu.cpus?.length ?? 1 },
    memory: {
      total: mem.total,
      used: mem.used,
      free: mem.free,
    },
    disk: {
      total: disk?.size ?? 0,
      used: disk?.used ?? 0,
    },
    network: {
      rx: net?.rx_bytes ?? 0,
      tx: net?.tx_bytes ?? 0,
    },
    uptime: time.uptime,
  };
}

export async function getServerMetrics(serverId: string): Promise<ServerStats> {
  const runtime = getRuntime(serverId);
  if (runtime) return runtime.getStats();
  const server = await getServer(serverId);
  return {
    cpuPercent: 0,
    memoryUsedMb: 0,
    memoryLimitMb: server.ramMb,
    diskUsedMb: 0,
    networkRxMb: 0,
    networkTxMb: 0,
    onlinePlayers: 0,
    maxPlayers: server.maxPlayers,
    uptimeSeconds: 0,
    processState: "stopped",
  };
}
