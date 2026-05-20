import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import type { ServerType } from "@prisma/client";
import { getAdapter } from "../adapters";
import { logger } from "../lib/logger";

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

function detectLoader(deps: Record<string, string>): { serverType: ServerType; minecraftVersion: string } {
  const mc = deps.minecraft ?? "1.20.1";
  if (deps["fabric-loader"] || deps.fabric) return { serverType: "FABRIC", minecraftVersion: mc };
  if (deps.quilt || deps["quilt-loader"]) return { serverType: "FABRIC", minecraftVersion: mc };
  if (deps.neoforge) return { serverType: "NEOFORGE", minecraftVersion: mc };
  if (deps.forge) return { serverType: "FORGE", minecraftVersion: mc };
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

async function downloadOneFile(
  dataPath: string,
  file: IndexFile
): Promise<void> {
  const dest = path.join(dataPath, file.path);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  const url = file.downloads[0];
  if (!url) throw new Error(`No download URL for ${file.path}`);

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Download failed ${file.path}: ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());

  if (file.hashes?.sha512) {
    const hash = crypto.createHash("sha512").update(buf).digest("hex");
    if (hash !== file.hashes.sha512) {
      throw new Error(`SHA512 mismatch for ${file.path}`);
    }
  }

  await fs.writeFile(dest, buf);
}

async function downloadIndexFiles(dataPath: string, files: IndexFile[]): Promise<number> {
  const toFetch = files.filter(shouldInstallOnServer);
  const concurrency = 6;
  let done = 0;

  for (let i = 0; i < toFetch.length; i += concurrency) {
    const batch = toFetch.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (file) => {
        try {
          await downloadOneFile(dataPath, file);
          done++;
        } catch (err) {
          logger.warn("Modrinth file download failed", {
            path: file.path,
            err: (err as Error).message,
          });
        }
      })
    );
  }

  return done;
}

/** Install a extracted .mrpack (modrinth.index.json present) into a playable server directory. */
export async function installMrpackFromIndex(
  dataPath: string,
  opts: { port: number; ramMb: number; javaVersion: string }
): Promise<MrpackInstallResult> {
  const indexPath = path.join(dataPath, "modrinth.index.json");
  const raw = await fs.readFile(indexPath, "utf8");
  const index = JSON.parse(raw) as ModrinthIndex;

  if (!index.files?.length) {
    throw new Error("modrinth.index.json has no files");
  }

  const deps = index.dependencies ?? {};
  const { serverType, minecraftVersion } = detectLoader(deps);

  logger.info("Installing Modrinth modpack from index", {
    dataPath,
    minecraftVersion,
    serverType,
    fileCount: index.files.length,
  });

  const adapter = getAdapter(serverType);
  await adapter.install({
    dataPath,
    minecraftVersion,
    ramMb: opts.ramMb,
    port: opts.port,
    javaVersion: opts.javaVersion,
  });

  const filesDownloaded = await downloadIndexFiles(dataPath, index.files);
  await applyOverrideDirs(dataPath);

  await fs.unlink(indexPath).catch(() => undefined);

  logger.info("Modrinth modpack install complete", {
    filesDownloaded,
    minecraftVersion,
    serverType,
  });

  return { minecraftVersion, serverType, filesDownloaded };
}
