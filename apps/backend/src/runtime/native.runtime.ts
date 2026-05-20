import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs/promises";
import type { RuntimeInstance, StartOptions } from "./types";
import type { ServerStats } from "@craftdock/shared";
import { logger } from "../lib/logger";
import { sanitizeConsoleCommand } from "../lib/sanitize";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

type OutputCallback = (data: string, type: "stdout" | "stderr") => void;

export class NativeRuntime implements RuntimeInstance {
  private process: ChildProcessWithoutNullStreams | null = null;
  private startedAt: number | null = null;
  private stoppingIntentionally = false;
  private outputCallbacks = new Set<OutputCallback>();
  private scrollback: string[] = [];
  private readonly maxScrollback = 5000;

  constructor(
    public serverId: string,
    private options: StartOptions
  ) {}

  attachOutput(callback: OutputCallback): void {
    this.outputCallbacks.add(callback);
    // Send recent scrollback to new subscribers
    if (this.scrollback.length) {
      callback(this.scrollback.join(""), "stdout");
    }
  }

  detachOutput(callback: OutputCallback): void {
    this.outputCallbacks.delete(callback);
  }

  private emit(data: string, type: "stdout" | "stderr"): void {
    this.scrollback.push(data);
    if (this.scrollback.length > this.maxScrollback) this.scrollback.shift();
    for (const cb of this.outputCallbacks) cb(data, type);
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed && this.process.exitCode === null;
  }

  private async onProcessExit(code: number | null): Promise<void> {
    this.emit(`\r\n[CraftDock] Process exited with code ${code}\r\n`, "stdout");
    this.process = null;

    const { removeRuntime } = await import("./runtime-manager");
    removeRuntime(this.serverId);

    const status = this.stoppingIntentionally || code === 0 ? "STOPPED" : "CRASHED";
    this.stoppingIntentionally = false;

    await prisma.server.update({
      where: { id: this.serverId },
      data: { status },
    }).catch(() => undefined);

    logger.info("Native server process exited", { serverId: this.serverId, code, status });
  }

  async start(): Promise<void> {
    if (this.isRunning()) return;

    const startScript = path.join(this.options.dataPath, "start.sh");
    await fs.chmod(startScript, 0o755);

    // Use spawn with script path only — never shell-interpolate user input
    // Line-buffer stdout so the web console updates live (Java buffers when not a TTY)
    this.process = spawn("stdbuf", ["-oL", "-eL", "/bin/bash", startScript], {
      cwd: this.options.dataPath,
      env: {
        ...process.env,
        JAVA_HOME: env.javaHome,
        MEMORY_MB: String(this.options.ramMb),
        SERVER_PORT: String(this.options.port),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.startedAt = Date.now();
    this.stoppingIntentionally = false;
    this.process.stdout.on("data", (buf) => this.emit(buf.toString(), "stdout"));
    this.process.stderr.on("data", (buf) => this.emit(buf.toString(), "stderr"));
    this.process.on("exit", (code) => {
      void this.onProcessExit(code);
    });
    this.process.on("error", (err) => {
      logger.error("Native runtime error", { serverId: this.serverId, err: err.message });
    });

    logger.info("Native server started", { serverId: this.serverId });
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this.stoppingIntentionally = true;
    await this.sendCommand("stop");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill("SIGTERM");
        resolve();
      }, 30000);
      this.process?.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async kill(): Promise<void> {
    this.stoppingIntentionally = true;
    this.process?.kill("SIGKILL");
    this.process = null;
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async sendCommand(command: string): Promise<void> {
    const safe = sanitizeConsoleCommand(command);
    if (!this.process?.stdin.writable) throw new Error("Server not running");
    this.process.stdin.write(safe + "\n");
  }

  async getStats(): Promise<ServerStats> {
    const uptimeSeconds = this.startedAt
      ? Math.floor((Date.now() - this.startedAt) / 1000)
      : 0;
    let memoryUsedMb = 0;
    if (this.process?.pid) {
      try {
        const si = await import("systeminformation");
        const procs = await si.processes();
        const proc = procs.list.find((p) => p.pid === this.process?.pid);
        if (proc?.mem) memoryUsedMb = Math.round(proc.mem / 1024 / 1024);
      } catch {
        /* optional */
      }
    }
    return {
      cpuPercent: 0,
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
}
