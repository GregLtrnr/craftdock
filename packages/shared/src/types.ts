import type {
  RUNTIME_MODES,
  SERVER_STATUSES,
  SERVER_TYPES,
  USER_ROLES,
} from "./constants";

export type ServerType = (typeof SERVER_TYPES)[number];
export type RuntimeMode = (typeof RUNTIME_MODES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type ServerStatus = (typeof SERVER_STATUSES)[number];

export interface ServerStats {
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  diskUsedMb: number;
  networkRxMb: number;
  networkTxMb: number;
  onlinePlayers: number;
  maxPlayers: number;
  tps?: number;
  uptimeSeconds: number;
  processState: "running" | "stopped" | "unknown";
}

export interface ConsoleMessage {
  type: "stdout" | "stderr" | "system";
  data: string;
  timestamp: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export interface ModpackSearchResult {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  logoUrl?: string;
  /** Present when CurseForge search returns latestFiles (avoids a separate /files call). */
  versions?: ModpackVersion[];
}

export interface ModpackVersion {
  id: number;
  name: string;
  gameVersion: string;
  fileName: string;
  downloadUrl: string;
}
