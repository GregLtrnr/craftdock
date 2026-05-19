import fs from "fs/promises";
import path from "path";
import { getServer } from "./server.service";
import { getRuntime } from "../runtime/runtime-manager";
import { resolveSafePath } from "../lib/secure-path";
import { AppError } from "../lib/errors";

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function getOnlinePlayers(serverId: string): Promise<string[]> {
  const runtime = getRuntime(serverId);
  if (!runtime?.isRunning()) return [];
  // Parse from console list command output would require hooking;
  // MVP: return empty, extend with RCON later
  return [];
}

export async function opPlayer(serverId: string, playerName: string, op = true): Promise<void> {
  const runtime = getRuntime(serverId);
  if (runtime?.isRunning()) {
    await runtime.sendCommand(op ? `op ${playerName}` : `deop ${playerName}`);
    return;
  }
  const server = await getServer(serverId);
  const opsPath = path.join(server.dataPath, "ops.json");
  let ops = await readJson<{ uuid: string; name: string; level: number; bypassesPlayerLimit: boolean }[]>(
    opsPath,
    []
  );
  if (op) {
    if (!ops.find((o) => o.name === playerName)) {
      ops.push({ uuid: "", name: playerName, level: 4, bypassesPlayerLimit: false });
    }
  } else {
    ops = ops.filter((o) => o.name !== playerName);
  }
  await writeJson(opsPath, ops);
}

export async function whitelistPlayer(serverId: string, playerName: string, add = true): Promise<void> {
  const runtime = getRuntime(serverId);
  if (runtime?.isRunning()) {
    await runtime.sendCommand(add ? `whitelist add ${playerName}` : `whitelist remove ${playerName}`);
    return;
  }
  const server = await getServer(serverId);
  const wlPath = path.join(server.dataPath, "whitelist.json");
  let list = await readJson<{ uuid: string; name: string }[]>(wlPath, []);
  if (add) {
    if (!list.find((p) => p.name === playerName)) {
      list.push({ uuid: "", name: playerName });
    }
  } else {
    list = list.filter((p) => p.name !== playerName);
  }
  await writeJson(wlPath, list);
}

export async function banPlayer(serverId: string, playerName: string, reason?: string): Promise<void> {
  const runtime = getRuntime(serverId);
  if (runtime?.isRunning()) {
    const cmd = reason ? `ban ${playerName} ${reason}` : `ban ${playerName}`;
    await runtime.sendCommand(cmd);
    return;
  }
  const server = await getServer(serverId);
  const banPath = path.join(server.dataPath, "banned-players.json");
  const bans = await readJson<{ uuid: string; name: string; created: string; source: string; reason: string }[]>(
    banPath,
    []
  );
  bans.push({
    uuid: "",
    name: playerName,
    created: new Date().toISOString(),
    source: "CraftDock",
    reason: reason ?? "Banned by admin",
  });
  await writeJson(banPath, bans);
}

export async function kickPlayer(serverId: string, playerName: string, reason?: string): Promise<void> {
  const runtime = getRuntime(serverId);
  if (!runtime?.isRunning()) throw new AppError(400, "Server not running");
  const cmd = reason ? `kick ${playerName} ${reason}` : `kick ${playerName}`;
  await runtime.sendCommand(cmd);
}

export async function getPlayerLists(serverId: string) {
  const server = await getServer(serverId);
  const root = server.dataPath;
  const [ops, whitelist, bannedPlayers, bannedIps] = await Promise.all([
    readJson(path.join(root, "ops.json"), []),
    readJson(path.join(root, "whitelist.json"), []),
    readJson(path.join(root, "banned-players.json"), []),
    readJson(path.join(root, "banned-ips.json"), []),
  ]);
  return { ops, whitelist, bannedPlayers, bannedIps };
}
