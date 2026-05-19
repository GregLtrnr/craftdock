import type { ServerStats } from "@craftdock/shared";

export interface RuntimeInstance {
  serverId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  kill(): Promise<void>;
  sendCommand(command: string): Promise<void>;
  getStats(): Promise<ServerStats>;
  isRunning(): boolean;
  attachOutput(callback: (data: string, type: "stdout" | "stderr") => void): void;
  detachOutput(callback: (data: string, type: "stdout" | "stderr") => void): void;
}

export interface StartOptions {
  serverId: string;
  dataPath: string;
  ramMb: number;
  port: number;
  javaVersion: string;
  startupScript: string;
  jarFile: string;
}
