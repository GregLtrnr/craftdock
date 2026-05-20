import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import type { ServerType } from "@prisma/client";
import { getAdapter } from "../adapters";
import { logger } from "../lib/logger";
import { appendInstallLog } from "../lib/install-log";
import { getFabricServerJarUrl } from "../lib/fabric-meta";

const USER_AGENT = "CraftDock/1.0 (https://github.com/craftdock)";

interface IndexFile {
  path: string;
  hashes?: { sha1?: string; sha512?: string };
  env?: { client?: string; server?: string };
  downloads: string[];
  fileSize?: number;
}

interface ModrinthIndex {
  formatVersion: number;
  dependencies?: Record<string, string>;
  files: IndexFile[];
}

export interface MrpackInstallResult {
  minecraftVersion: string;
  serverType: ServerType;
  filesDownloaded: number;
}

function detectLoader(deps: Record<string, string>): {
  serverType: ServerType;
  minecraftVersion: string;
  loaderVersion?: string;
} {
  const mc = deps.minecraft ?? "1.20.1";
  if (deps["fabric-loader"]) {
    return { serverType: "FABRIC", minecraftVersion: mc, loaderVersion: deps["fabric-loader"] };
  }
  if (deps.fabric) {
    return { serverType: "FABRIC", minecraftVersion: mc, loaderVersion: deps.fabric };
  }
  if (deps.quilt || deps["quilt-loader"]) {
    return { serverType: "FABRIC", minecraftVersion: mc, loaderVersion: deps["quilt-loader"] ?? deps.quilt };
  }
  if (deps.neoforge) {
    return { serverType: "NEOFORGE", minecraftVersion: mc, loaderVersion: deps.neoforge };
  }
  if (deps.forge) {
    return { serverType: "FORGE", minecraftVersion: mc, loaderVersion: deps.forge };
  }
  return { serverType: "VANILLA", minecraftVersion: mc };
}

function shouldInstallOnServer(file: IndexFile): boolean {
  const { server, client } = file.env ?? {};
  if (server === "unsupported") return false;
  if (server === "required" || server === "optional") return true;
  if (client === "required" && server !== "required" && server !== "optional") return false;
  return true;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDirMerge(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(to, { recursive: true });
      await copyDirMerge(from, to);
    } else {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }
  }
}

async function applyOverrideDirs(dataPath: string): Promise<void> {
  for (const dir of ["overrides-server", "server-overrides", "overrides"]) {
    const src = path.join(dataPath, dir);
    if (await fileExists(src)) {
      await copyDirMerge(src, dataPath);
      await fs.rm(src, { recursive: true, force: true });
    }
  }
}

async function downloadOneFile(dataPath: string, file: IndexFile): Promise<void> {
  const dest = path.join(dataPath, file.path);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  const url = file.downloads[0];
  if (!url) throw new Error(`No download URL for ${file.path}`);

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());

  if (file.hashes?.sha512) {
    const hash = crypto.createHash("sha512").update(buf).digest("hex");
    if (hash !== file.hashes.sha512) {
      throw new Error(`SHA512 mismatch`);
    }
  }

  await fs.writeFile(dest, buf);
}

async function writeServerBootstrap(
  dataPath: string,
  opts: { port: number; ramMb: number }
): Promise<void> {
  await fs.writeFile(
    path.join(dataPath, "eula.txt"),
    "eula=false\n# Accept EULA from CraftDock panel\n"
  );
  const props = [
    `server-port=${opts.port}`,
    "gamemode=survival",
    "difficulty=normal",
    "max-players=20",
    "online-mode=true",
    "motd=A CraftDock Server",
  ].join("\n");
  await fs.writeFile(path.join(dataPath, "server.properties"), props + "\n");
  const script = `#!/bin/bash
set -e
cd "$(dirname "$0")"
JAVA="\${JAVA_HOME:-/opt/java-home}/bin/java"
MEM="${opts.ramMb}"
exec "$JAVA" -Xms\${MEM}M -Xmx\${MEM}M -jar server.jar nogui
`;
  await fs.writeFile(path.join(dataPath, "start.sh"), script, { mode: 0o755 });
}

async function installFabricJar(
  dataPath: string,
  minecraftVersion: string,
  loaderVersion: string | undefined,
  opts: { port: number; ramMb: number }
): Promise<void> {
  const url = await getFabricServerJarUrl(minecraftVersion, loaderVersion);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fabric server jar download failed: ${res.status}`);
  await fs.writeFile(path.join(dataPath, "server.jar"), Buffer.from(await res.arrayBuffer()));
  await writeServerBootstrap(dataPath, opts);
}

/** Install a extracted .mrpack (modrinth.index.json present) into a playable server directory. */
export async function installMrpackFromIndex(
  dataPath: string,
  serverId: string,
  opts: { port: number; ramMb: number; javaVersion: string }
): Promise<MrpackInstallResult> {
  const log = (msg: string) => appendInstallLog(serverId, "info", msg);

  const indexPath = path.join(dataPath, "modrinth.index.json");
  if (!(await fileExists(indexPath))) {
    throw new Error("modrinth.index.json not found after archive extract");
  }

  await log("Reading modrinth.index.json…");
  const raw = await fs.readFile(indexPath, "utf8");
  const index = JSON.parse(raw) as ModrinthIndex;

  if (!index.files?.length) {
    throw new Error("modrinth.index.json has no files");
  }

  const deps = index.dependencies ?? {};
  const { serverType, minecraftVersion, loaderVersion } = detectLoader(deps);
  const toFetch = index.files.filter(shouldInstallOnServer);

  await log(
    `Pack: Minecraft ${minecraftVersion}, loader ${serverType}` +
      (loaderVersion ? ` ${loaderVersion}` : "") +
      ` — ${toFetch.length} files to download`
  );

  if (serverType === "FABRIC") {
    await log("Downloading Fabric server jar…");
    await installFabricJar(dataPath, minecraftVersion, loaderVersion, opts);
    await log("Fabric server jar installed");
  } else if (serverType === "FORGE" || serverType === "NEOFORGE") {
    throw new Error(
      `${serverType} modpack auto-install is not supported yet — use a Fabric-based pack or install Forge manually`
    );
  } else {
    await log("Installing vanilla server jar…");
    const adapter = getAdapter("VANILLA");
    await adapter.install({
      dataPath,
      minecraftVersion,
      ramMb: opts.ramMb,
      port: opts.port,
      javaVersion: opts.javaVersion,
    });
    await log("Vanilla server jar installed");
  }

  let done = 0;
  const concurrency = 6;
  for (let i = 0; i < toFetch.length; i += concurrency) {
    const batch = toFetch.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (file) => {
        try {
          await downloadOneFile(dataPath, file);
          done++;
          if (done % 25 === 0 || done === toFetch.length) {
            await log(`Downloaded ${done}/${toFetch.length} files…`);
          }
        } catch (err) {
          await appendInstallLog(
            serverId,
            "warn",
            `Skipped ${file.path}: ${(err as Error).message}`
          );
        }
      })
    );
  }

  if (toFetch.length > 0 && done === 0) {
    throw new Error(`Failed to download any of ${toFetch.length} mod files — check backend network`);
  }

  await log(`Applying overrides…`);
  await applyOverrideDirs(dataPath);

  const modsDir = path.join(dataPath, "mods");
  let modCount = 0;
  if (await fileExists(modsDir)) {
    modCount = (await fs.readdir(modsDir)).filter((f) => f.endsWith(".jar")).length;
  }

  await fs.unlink(indexPath).catch(() => undefined);

  await log(`Install complete: ${done} files, ${modCount} mods in /mods, server.jar present`);

  if (!(await fileExists(path.join(dataPath, "server.jar")))) {
    throw new Error("server.jar missing after install");
  }

  logger.info("Modrinth modpack install complete", {
    serverId,
    filesDownloaded: done,
    modCount,
    minecraftVersion,
    serverType,
  });

  return { minecraftVersion, serverType, filesDownloaded: done };
}
