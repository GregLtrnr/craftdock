import path from "path";
import fs from "fs/promises";
import tar from "tar";
import { AppError } from "../lib/errors";
import type { ModpackSearchResult, ModpackVersion } from "@craftdock/shared";
import { logger } from "../lib/logger";

const BASE_URL = "https://api.modrinth.com/v2";
const USER_AGENT = "CraftDock/1.0 (https://github.com/craftdock)";

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
  files: {
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
}

/**
 * Modrinth API — no API key required, stable for search + versions + CDN download.
 * @see https://docs.modrinth.com/api/
 */
export class ModrinthService {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("Modrinth API error", { path, status: res.status, body: body.slice(0, 200) });
      throw new AppError(
        res.status,
        `Modrinth API error: ${res.statusText}`,
        "MODRINTH_ERROR"
      );
    }
    return res.json() as Promise<T>;
  }

  async searchModpacks(query: string, offset = 0, limit = 20): Promise<ModpackSearchResult[]> {
    const facets = encodeURIComponent('[["project_type:modpack"]]');
    const data = await this.request<{
      hits: MrSearchHit[];
    }>(
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
        const file = v.files.find((f) => f.primary) ?? v.files[0]!;
        return {
          id: v.id,
          name: v.name || v.version_number,
          gameVersion: v.game_versions[0] ?? "unknown",
          fileName: file.filename,
          downloadUrl: file.url,
        };
      });
  }

  async installVersionToServer(versionId: string, dataPath: string): Promise<void> {
    const version = await this.request<MrVersion>(`/version/${encodeURIComponent(versionId)}`);
    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file) throw new AppError(404, "No downloadable file for this version", "MODRINTH_NO_FILE");

    const res = await fetch(file.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      throw new AppError(502, `Failed to download modpack: ${res.statusText}`);
    }

    const archivePath = path.join(dataPath, file.filename);
    await fs.writeFile(archivePath, Buffer.from(await res.arrayBuffer()));
    await tar.x({ file: archivePath, cwd: dataPath });
    logger.info("Modrinth modpack extracted", { versionId, file: file.filename });
  }
}

export const modrinthService = new ModrinthService();
