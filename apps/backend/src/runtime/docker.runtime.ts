import Docker from "dockerode";
import type { RuntimeInstance, StartOptions } from "./types";
import type { ServerStats } from "@craftdock/shared";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { sanitizeConsoleCommand } from "../lib/sanitize";

type OutputCallback = (data: string, type: "stdout" | "stderr") => void;

export class DockerRuntime implements RuntimeInstance {
  private docker = new Docker();
  private containerId: string | null = null;
  private stream: NodeJS.ReadWriteStream | null = null;
  private outputCallbacks = new Set<OutputCallback>();
  private startedAt: number | null = null;

  constructor(
    public serverId: string,
    private options: StartOptions,
    existingContainerId?: string | null
  ) {
    this.containerId = existingContainerId ?? null;
  }

  attachOutput(callback: OutputCallback): void {
    this.outputCallbacks.add(callback);
  }

  detachOutput(callback: OutputCallback): void {
    this.outputCallbacks.delete(callback);
  }

  private emit(data: string, type: "stdout" | "stderr"): void {
    for (const cb of this.outputCallbacks) cb(data, type);
  }

  isRunning(): boolean {
    return !!this.containerId;
  }

  async start(): Promise<void> {
    const name = `craftdock-${this.serverId.slice(0, 8)}`;
    const container = await this.docker.createContainer({
      name,
      Image: env.dockerImage,
      HostConfig: {
        Memory: this.options.ramMb * 1024 * 1024,
        PortBindings: {
          "25565/tcp": [{ HostPort: String(this.options.port) }],
        },
        Binds: [`${this.options.dataPath}:/data`],
        NetworkMode: env.dockerNetwork,
        AutoRemove: false,
      },
      Env: [
        `MEMORY=${this.options.ramMb}M`,
        `EULA=TRUE`,
        `VERSION=${process.env.MC_VERSION ?? "LATEST"}`,
      ],
      Tty: true,
      OpenStdin: true,
    });

    await container.start();
    this.containerId = container.id;
    this.startedAt = Date.now();

    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 100,
    });
    logStream.on("data", (chunk: Buffer) => {
      this.emit(chunk.toString("utf8").replace(/^\x01[\x00-\x02]/, ""), "stdout");
    });

    const attach = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    this.stream = attach;
    attach.on("data", (chunk: Buffer) => this.emit(chunk.toString(), "stdout"));

    logger.info("Docker server started", { serverId: this.serverId, containerId: this.containerId });
  }

  async stop(): Promise<void> {
    if (!this.containerId) return;
    const container = this.docker.getContainer(this.containerId);
    await container.stop({ t: 30 }).catch(() => undefined);
    this.containerId = null;
    this.stream = null;
  }

  async kill(): Promise<void> {
    if (!this.containerId) return;
    const container = this.docker.getContainer(this.containerId);
    await container.kill().catch(() => undefined);
    this.containerId = null;
  }

  async restart(): Promise<void> {
    if (!this.containerId) return this.start();
    const container = this.docker.getContainer(this.containerId);
    await container.restart();
  }

  async sendCommand(command: string): Promise<void> {
    const safe = sanitizeConsoleCommand(command);
    if (!this.stream) throw new Error("Container not attached");
    this.stream.write(safe + "\n");
  }

  async getStats(): Promise<ServerStats> {
    const uptimeSeconds = this.startedAt
      ? Math.floor((Date.now() - this.startedAt) / 1000)
      : 0;
    let memoryUsedMb = 0;
    let cpuPercent = 0;
    if (this.containerId) {
      try {
        const container = this.docker.getContainer(this.containerId);
        const stats = await container.stats({ stream: false });
        const mem = (stats as { memory_stats?: { usage?: number } }).memory_stats?.usage ?? 0;
        memoryUsedMb = Math.round(mem / 1024 / 1024);
        const cpu = (stats as { cpu_stats?: { cpu_usage?: { total_usage?: number } } }).cpu_stats;
        cpuPercent = cpu?.cpu_usage?.total_usage ? 1 : 0;
      } catch {
        /* optional */
      }
    }
    return {
      cpuPercent,
      memoryUsedMb,
      memoryLimitMb: this.options.ramMb,
      diskUsedMb: 0,
      networkRxMb: 0,
      networkTxMb: 0,
      onlinePlayers: 0,
      maxPlayers: 20,
      uptimeSeconds,
      processState: this.isRunning() ? "running" : "stopped",
    };
  }

  getContainerId(): string | null {
    return this.containerId;
  }
}
