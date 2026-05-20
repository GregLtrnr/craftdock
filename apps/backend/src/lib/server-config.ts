import path from "path";
import fs from "fs/promises";
import net from "net";

function parsePropertyLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const idx = trimmed.indexOf("=");
  if (idx === -1) return null;
  return { key: trimmed.slice(0, idx), value: trimmed.slice(idx + 1) };
}

/** Sync server.properties + start.sh so Minecraft listens on all interfaces on the assigned port. */
export async function syncServerRuntimeConfig(
  dataPath: string,
  opts: { port: number; ramMb: number }
): Promise<{ fixedPort: boolean; fixedServerIp: boolean }> {
  const propsPath = path.join(dataPath, "server.properties");
  let raw = "";
  try {
    raw = await fs.readFile(propsPath, "utf8");
  } catch {
    raw = "";
  }

  let fixedPort = false;
  let fixedServerIp = false;
  const keptLines: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split("\n")) {
    const parsed = parsePropertyLine(line);
    if (!parsed) {
      keptLines.push(line);
      continue;
    }
    if (parsed.key === "server-port") {
      if (parsed.value !== String(opts.port)) fixedPort = true;
      continue;
    }
    if (parsed.key === "server-ip") {
      if (parsed.value && parsed.value !== "0.0.0.0") fixedServerIp = true;
      continue;
    }
    keptLines.push(line);
    seen.add(parsed.key);
  }

  if (!seen.has("gamemode")) keptLines.push("gamemode=survival");
  if (!seen.has("difficulty")) keptLines.push("difficulty=normal");
  if (!seen.has("max-players")) keptLines.push("max-players=20");
  if (!seen.has("online-mode")) keptLines.push("online-mode=true");
  if (!seen.has("motd")) keptLines.push("motd=A CraftDock Server");

  keptLines.push(`server-port=${opts.port}`);

  const body = keptLines.join("\n").replace(/\n+$/, "") + "\n";
  await fs.writeFile(propsPath, body);

  const script = `#!/bin/bash
set -e
cd "$(dirname "$0")"
JAVA="\${JAVA_HOME:-/opt/java-home}/bin/java"
MEM="${opts.ramMb}"
exec stdbuf -oL -eL "$JAVA" -Djava.net.preferIPv4Stack=true -Xms\${MEM}M -Xmx\${MEM}M -jar server.jar nogui
`;
  await fs.writeFile(path.join(dataPath, "start.sh"), script, { mode: 0o755 });

  return { fixedPort, fixedServerIp };
}

export async function readServerProperties(
  dataPath: string
): Promise<{ serverPort?: number; serverIp?: string }> {
  try {
    const raw = await fs.readFile(path.join(dataPath, "server.properties"), "utf8");
    let serverPort: number | undefined;
    let serverIp: string | undefined;
    for (const line of raw.split("\n")) {
      const parsed = parsePropertyLine(line);
      if (!parsed) continue;
      if (parsed.key === "server-port") serverPort = parseInt(parsed.value, 10);
      if (parsed.key === "server-ip") serverIp = parsed.value.trim();
    }
    return { serverPort, serverIp };
  } catch {
    return {};
  }
}

export function isTcpPortOpen(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const finish = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
