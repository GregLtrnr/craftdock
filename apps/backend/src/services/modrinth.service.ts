import path from "path";
import fs from "fs/promises";
import { AppError } from "../lib/errors";
import type { ModpackSearchResult, ModpackVersion } from "@craftdock/shared";
import { logger } from "../lib/logger";
import { extractArchive, removeFileIfExists } from "../lib/extract-archive";
import { appendInstallLog } from "../lib/install-log";
import { installMrpackFromIndex, type MrpackInstallResult } from "./modrinth-mrpack";

const BASE_URL = "https://api.modrinth.com/v2";
const USER_AGENT = "CraftDock/1.0 (https://github.com/craftdock)";

interface MrFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

interface MrSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  downloads: number;
  icon_url?: string;
  versions: string[];
}

interface MrVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  version_type: string;
  files: MrFile[];
}

export type ModrinthInstallOptions = {
  port: number;
  ramMb: number;
  javaVersion: string;
};

function pickInstallFile(files: MrFile[]): MrFile | undefined {
  const rank = (f: MrFile) => {
    const n = f.filename.toLowerCase();
    if (/server/i.test(n) && n.endsWith(".zip")) return 0;
    if (n.endsWith(".zip") && !n.endsWith(".mrpack")) return 1;
    if (n.endsWith(".mrpack")) return 2;
    if (f.primary) return 3;
    return 4;
  };
  return [...files].sort((a, b) => rank(a) - rank(b))[0];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Modrinth API — no API key required.
 * @see https://docs.modrinth.com/api/
 */
export class ModrinthService {
  private async request<T>(reqPath: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${reqPath}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("Modrinth API error", { path: reqPath, status: res.status, body: body.slice(0, 200) });
      throw new AppError(res.status, `Modrinth API error: ${res.statusText}`, "MODRINTH_ERROR");
    }
    return res.json() as Promise<T>;
  }

  async searchModpacks(query: string, offset = 0, limit = 20): Promise<ModpackSearchResult[]> {
    const facets = encodeURIComponent('[["project_type:modpack"]]');
    const data = await this.request<{ hits: MrSearchHit[] }>(
      `/search?query=${encodeURIComponent(query)}&facets=${facets}&limit=${limit}&offset=${offset}&index=relevance`
    );

    return data.hits.map((hit) => ({
      source: "modrinth" as const,
      id: hit.project_id,
      name: hit.title,
      slug: hit.slug,
      summary: hit.description,
      downloadCount: hit.downloads,
      logoUrl: hit.icon_url,
    }));
  }

  async getModpackVersions(projectIdOrSlug: string): Promise<ModpackVersion[]> {
    const versions = await this.request<MrVersion[]>(
      `/project/${encodeURIComponent(projectIdOrSlug)}/version`
    );

    return versions
      .filter((v) => v.files.length > 0)
      .map((v) => {
        const file = pickInstallFile(v.files)!;
        const isMrpack = file.filename.toLowerCase().endsWith(".mrpack");
        return {
          id: v.id,
          name: `${v.name || v.version_number}${isMrpack ? " (full install)" : ""}`,
          gameVersion: v.game_versions[0] ?? "unknown",
          fileName: file.filename,
          downloadUrl: file.url,
        };
      });
  }

  async installVersionToServer(
    versionId: string,
    dataPath: string,
    serverId: string,
    opts: ModrinthInstallOptions
  ): Promise<MrpackInstallResult | null> {
    const version = await this.request<MrVersion>(`/version/${encodeURIComponent(versionId)}`);
    const file = pickInstallFile(version.files);
    if (!file) throw new AppError(404, "No downloadable file for this version", "MODRINTH_NO_FILE");

    await appendInstallLog(serverId, "info", `Downloading ${file.filename}…`);

    const res = await fetch(file.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      throw new AppError(502, `Failed to download modpack: ${res.statusText}`);
    }

    const archivePath = path.join(dataPath, file.filename);
    await fs.writeFile(archivePath, Buffer.from(await res.arrayBuffer()));
    await appendInstallLog(serverId, "info", "Extracting archive…");
    await extractArchive(archivePath, dataPath);
    await removeFileIfExists(archivePath);

    const indexPath = path.join(dataPath, "modrinth.index.json");
    if (await fileExists(indexPath)) {
      return installMrpackFromIndex(dataPath, serverId, opts);
    }

    logger.info("Modrinth zip extracted (no index — assuming pre-built server pack)", {
      versionId,
    });
    return null;
  }
}

export const modrinthService = new ModrinthService();
