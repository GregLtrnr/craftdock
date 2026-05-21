import path from "path";
import fs from "fs/promises";
import type { ServerType } from "@prisma/client";
import { AppError } from "../lib/errors";
import { extractArchive, removeFileIfExists } from "../lib/extract-archive";
import { appendInstallLog } from "../lib/install-log";
import { installMrpackFromIndex, type MrpackInstallResult } from "./modrinth-mrpack";
import { syncServerRuntimeConfig } from "../lib/server-config";
import { getFabricServerJarUrl } from "../lib/fabric-meta";
import { getAdapter } from "../adapters";
import type { ModpackInstallMeta } from "./modpack.service";
import { MAX_MODPACK_UPLOAD_BYTES } from "@craftdock/shared";

const UPLOAD_ARCHIVE = "_upload.pack.zip";

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** If the zip extracted into a single top-level folder, hoist contents to dataPath. */
async function normalizeExtractedRoot(dataPath: string): Promise<void> {
  const entries = await fs.readdir(dataPath, { withFileTypes: true });
  const visible = entries.filter((e) => e.name !== UPLOAD_ARCHIVE && !e.name.startsWith("."));
  if (visible.length !== 1 || !visible[0].isDirectory()) return;

  const inner = path.join(dataPath, visible[0].name);
  const innerEntries = await fs.readdir(inner);
  for (const name of innerEntries) {
    const from = path.join(inner, name);
    const to = path.join(dataPath, name);
    await fs.rename(from, to).catch(async () => {
      await fs.cp(from, to, { recursive: true });
      await fs.rm(from, { recursive: true, force: true });
    });
  }
  await fs.rm(inner, { recursive: true, force: true });
}

async function applyOverrideDirs(dataPath: string): Promise<void> {
  for (const dir of ["overrides-server", "server-overrides", "overrides"]) {
    const src = path.join(dataPath, dir);
    if (!(await fileExists(src))) continue;
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const from = path.join(src, entry.name);
      const to = path.join(dataPath, entry.name);
      if (entry.isDirectory()) {
        await fs.cp(from, to, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(to), { recursive: true });
        await fs.copyFile(from, to);
      }
    }
    await fs.rm(src, { recursive: true, force: true });
  }
}

interface DetectedPack {
  minecraftVersion: string;
  serverType: ServerType;
  loaderVersion?: string;
}

function parseModLoaderId(id: string): Partial<DetectedPack> {
  const lower = id.toLowerCase();
  if (lower.startsWith("neoforge-")) {
    return { serverType: "NEOFORGE", loaderVersion: id.slice("neoforge-".length) };
  }
  if (lower.startsWith("forge-")) {
    return { serverType: "FORGE", loaderVersion: id.slice("forge-".length) };
  }
  const fabricMatch = id.match(/^fabric(?:-loader)?-(.+)$/i);
  if (fabricMatch) {
    return { serverType: "FABRIC", loaderVersion: fabricMatch[1] };
  }
  return {};
}

async function detectFromManifest(dataPath: string): Promise<DetectedPack | null> {
  const manifestPath = path.join(dataPath, "manifest.json");
  if (!(await fileExists(manifestPath))) return null;

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as {
      minecraft?: {
        version?: string;
        modLoaders?: { id: string; primary?: boolean }[];
      };
    };
    const mc = manifest.minecraft?.version;
    const loaders = manifest.minecraft?.modLoaders ?? [];
    const primary = loaders.find((l) => l.primary) ?? loaders[0];
    if (!mc) return null;

    const base: DetectedPack = { minecraftVersion: mc, serverType: "FABRIC" };
    if (primary?.id) {
      const parsed = parseModLoaderId(primary.id);
      return { ...base, ...parsed, minecraftVersion: mc };
    }
    return base;
  } catch {
    return null;
  }
}

async function detectFromInstanceJson(dataPath: string): Promise<DetectedPack | null> {
  const p = path.join(dataPath, "minecraftinstance.json");
  if (!(await fileExists(p))) return null;
  try {
    const raw = await fs.readFile(p, "utf8");
    const inst = JSON.parse(raw) as {
      gameVersion?: string;
      baseModLoader?: { name?: string; version?: string };
    };
    if (!inst.gameVersion) return null;
    const name = inst.baseModLoader?.name?.toUpperCase() ?? "";
    const ver = inst.baseModLoader?.version;
    if (name.includes("FABRIC")) {
      return { minecraftVersion: inst.gameVersion, serverType: "FABRIC", loaderVersion: ver };
    }
    if (name.includes("NEOFORGE")) {
      return { minecraftVersion: inst.gameVersion, serverType: "NEOFORGE", loaderVersion: ver };
    }
    if (name.includes("FORGE")) {
      return { minecraftVersion: inst.gameVersion, serverType: "FORGE", loaderVersion: ver };
    }
    return { minecraftVersion: inst.gameVersion, serverType: "FABRIC" };
  } catch {
    return null;
  }
}

async function detectPackMeta(
  dataPath: string,
  hintVersion?: string
): Promise<DetectedPack> {
  const fromManifest = await detectFromManifest(dataPath);
  if (fromManifest) return fromManifest;

  const fromInstance = await detectFromInstanceJson(dataPath);
  if (fromInstance) return fromInstance;

  if (hintVersion) {
    return { minecraftVersion: hintVersion, serverType: "FABRIC" };
  }

  return { minecraftVersion: "1.20.1", serverType: "FABRIC" };
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
  await fs.writeFile(
    path.join(dataPath, "eula.txt"),
    "eula=false\n# Accept EULA from CraftDock panel\n"
  );
  await syncServerRuntimeConfig(dataPath, opts);
}

async function installServerJar(
  dataPath: string,
  detected: DetectedPack,
  opts: { port: number; ramMb: number; javaVersion: string },
  log: (msg: string) => Promise<void>
): Promise<MrpackInstallResult> {
  if (await fileExists(path.join(dataPath, "server.jar"))) {
    await log("Using server.jar from the uploaded pack");
    await syncServerRuntimeConfig(dataPath, { port: opts.port, ramMb: opts.ramMb });
    return {
      minecraftVersion: detected.minecraftVersion,
      serverType: detected.serverType,
      filesDownloaded: 0,
    };
  }

  if (detected.serverType === "FABRIC") {
    await log(`Installing Fabric server for Minecraft ${detected.minecraftVersion}…`);
    await installFabricJar(dataPath, detected.minecraftVersion, detected.loaderVersion, opts);
    return {
      minecraftVersion: detected.minecraftVersion,
      serverType: "FABRIC",
      filesDownloaded: 0,
    };
  }

  if (detected.serverType === "FORGE" || detected.serverType === "NEOFORGE") {
    throw new AppError(
      400,
      `${detected.serverType} server packs from a zip are not auto-installed yet. Use a Fabric pack or install the Forge/NeoForge server jar manually in Files.`,
      "FORGE_UPLOAD_UNSUPPORTED"
    );
  }

  await log(`Installing vanilla server ${detected.minecraftVersion}…`);
  const adapter = getAdapter("VANILLA");
  await adapter.install({
    dataPath,
    minecraftVersion: detected.minecraftVersion,
    ramMb: opts.ramMb,
    port: opts.port,
    javaVersion: opts.javaVersion,
  });
  return {
    minecraftVersion: detected.minecraftVersion,
    serverType: "VANILLA",
    filesDownloaded: 0,
  };
}

/** Install a CurseForge / Modrinth-style server pack zip uploaded by the user. */
export async function installUploadedModpackZip(
  dataPath: string,
  serverId: string,
  opts: { port: number; ramMb: number; javaVersion: string; minecraftVersion?: string }
): Promise<ModpackInstallMeta> {
  const log = (msg: string) => appendInstallLog(serverId, "info", msg);

  const archivePath = path.join(dataPath, UPLOAD_ARCHIVE);
  if (!(await fileExists(archivePath))) {
    throw new AppError(400, "Upload archive missing on server", "UPLOAD_MISSING");
  }

  await log("Extracting uploaded modpack…");
  await extractArchive(archivePath, dataPath);
  await removeFileIfExists(archivePath);
  await normalizeExtractedRoot(dataPath);

  const indexPath = path.join(dataPath, "modrinth.index.json");
  if (await fileExists(indexPath)) {
    await log("Detected Modrinth .mrpack index — installing mods and loader…");
    const result = await installMrpackFromIndex(dataPath, serverId, opts);
    return { minecraftVersion: result.minecraftVersion, serverType: result.serverType };
  }

  await log("Applying overrides…");
  await applyOverrideDirs(dataPath);

  const detected = await detectPackMeta(dataPath, opts.minecraftVersion);
  await log(
    `Detected Minecraft ${detected.minecraftVersion}, loader ${detected.serverType}` +
      (detected.loaderVersion ? ` ${detected.loaderVersion}` : "")
  );

  const result = await installServerJar(dataPath, detected, opts, log);
  await log("Uploaded modpack install complete");

  return { minecraftVersion: result.minecraftVersion, serverType: result.serverType };
}

function validateArchiveName(originalName: string): void {
  const lower = originalName.toLowerCase();
  if (!lower.endsWith(".zip") && !lower.endsWith(".mrpack")) {
    throw new AppError(
      400,
      "Only .zip or .mrpack files are supported (CurseForge “Download server pack”)",
      "INVALID_ARCHIVE"
    );
  }
}

/** Save uploaded file before async install starts (disk temp path or buffer). */
export async function saveUploadedModpackArchive(
  dataPath: string,
  source: { tempPath: string } | { buffer: Buffer },
  originalName: string
): Promise<void> {
  validateArchiveName(originalName);
  const dest = path.join(dataPath, UPLOAD_ARCHIVE);

  if ("tempPath" in source) {
    const stat = await fs.stat(source.tempPath);
    if (stat.size > MAX_MODPACK_UPLOAD_BYTES) {
      await fs.unlink(source.tempPath).catch(() => undefined);
      throw new AppError(400, "Modpack file must be under 5 GB", "FILE_TOO_LARGE");
    }
    await fs.rename(source.tempPath, dest).catch(async () => {
      await fs.copyFile(source.tempPath, dest);
      await fs.unlink(source.tempPath);
    });
    return;
  }

  if (source.buffer.length > MAX_MODPACK_UPLOAD_BYTES) {
    throw new AppError(400, "Modpack file must be under 5 GB", "FILE_TOO_LARGE");
  }
  await fs.writeFile(dest, source.buffer);
}
