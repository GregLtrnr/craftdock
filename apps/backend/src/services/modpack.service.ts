import { env } from "../config/env";
import { AppError } from "../lib/errors";
import type { ModpackSearchResult, ModpackVersion, ModpackSource } from "@craftdock/shared";
import { curseForgeService } from "./curseforge.service";
import { modrinthService } from "./modrinth.service";

export function parseModpackSource(value: unknown): ModpackSource {
  return value === "curseforge" ? "curseforge" : "modrinth";
}

export async function searchModpacks(
  source: ModpackSource,
  query: string,
  page: number,
  pageSize: number
): Promise<ModpackSearchResult[]> {
  if (source === "modrinth") {
    return modrinthService.searchModpacks(query, page * pageSize, pageSize);
  }
  if (!env.curseforgeApiKey) {
    throw new AppError(
      503,
      "CurseForge is not configured. Set CURSEFORGE_API_KEY or use source=modrinth (default).",
      "CURSEFORGE_NOT_CONFIGURED"
    );
  }
  return curseForgeService.searchModpacks(query, page, pageSize);
}

export async function getModpackVersions(
  source: ModpackSource,
  projectId: string,
  slug?: string
): Promise<ModpackVersion[]> {
  if (source === "modrinth") {
    return modrinthService.getModpackVersions(projectId);
  }
  if (!env.curseforgeApiKey) {
    throw new AppError(503, "CurseForge API key not configured", "CURSEFORGE_NOT_CONFIGURED");
  }
  const modId = parseInt(projectId, 10);
  if (Number.isNaN(modId)) {
    throw new AppError(400, "Invalid CurseForge project id", "INVALID_PROJECT_ID");
  }
  return curseForgeService.getModpackFiles(modId, slug);
}

export interface ModpackInstallMeta {
  minecraftVersion?: string;
  serverType?: "VANILLA" | "PAPER" | "PURPUR" | "FABRIC" | "FORGE" | "NEOFORGE" | "MODPACK";
}

export async function installModpackToServer(
  source: ModpackSource,
  projectId: string,
  versionId: string,
  dataPath: string,
  opts?: { serverId: string; port: number; ramMb: number; javaVersion: string }
): Promise<ModpackInstallMeta> {
  if (source === "modrinth") {
    if (!opts?.serverId) throw new AppError(400, "Server options required for Modrinth install");
    const { serverId, ...installOpts } = opts;
    const result = await modrinthService.installVersionToServer(
      versionId,
      dataPath,
      serverId,
      installOpts
    );
    if (result) {
      return { minecraftVersion: result.minecraftVersion, serverType: result.serverType };
    }
    return {};
  }
  const modId = parseInt(projectId, 10);
  const fileId = parseInt(versionId, 10);
  if (Number.isNaN(modId) || Number.isNaN(fileId)) {
    throw new AppError(400, "Invalid CurseForge ids", "INVALID_IDS");
  }
  const pathMod = await import("path");
  const fs = await import("fs/promises");
  const { extractArchive, removeFileIfExists } = await import("../lib/extract-archive");
  const { buffer, fileName } = await curseForgeService.downloadModpackFile(modId, fileId);
  const archivePath = pathMod.join(dataPath, fileName);
  await fs.writeFile(archivePath, buffer);
  await extractArchive(archivePath, dataPath);
  await removeFileIfExists(archivePath);
  return {};
}

export async function getModpackSourcesStatus(): Promise<{
  modrinth: { available: true };
  curseforge: { available: boolean; configured: boolean };
}> {
  let cfAvailable = false;
  if (env.curseforgeApiKey) {
    try {
      const res = await fetch(
        "https://api.curseforge.com/v1/mods/search?gameId=432&searchFilter=test&pageSize=1",
        {
          headers: {
            Accept: "application/json",
            "x-api-key": env.curseforgeApiKey,
            "User-Agent": "CraftDock/1.0",
          },
        }
      );
      cfAvailable = res.ok;
    } catch {
      cfAvailable = false;
    }
  }
  return {
    modrinth: { available: true },
    curseforge: { available: cfAvailable, configured: Boolean(env.curseforgeApiKey) },
  };
}
