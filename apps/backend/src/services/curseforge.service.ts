import { env } from "../config/env";
import { AppError } from "../lib/errors";
import type { ModpackSearchResult, ModpackVersion } from "@craftdock/shared";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const BASE_URL = "https://api.curseforge.com/v1";

interface CfFile {
  id: number;
  displayName: string;
  gameVersions: string[];
  fileName: string;
  downloadUrl?: string;
  isServerPack?: boolean;
}

interface CfMod {
  id: number;
  name: string;
  slug: string;
  latestFiles?: CfFile[];
  latestFilesIndexes?: { fileId: number; gameVersion: string; filename: string }[];
}

/**
 * CurseForge API abstraction — requires CURSEFORGE_API_KEY in .env
 * Get a key at https://console.curseforge.com/
 */
export class CurseForgeService {
  private get apiKey(): string {
    if (!env.curseforgeApiKey) {
      throw new AppError(
        503,
        "CurseForge API key not configured. Set CURSEFORGE_API_KEY in .env",
        "CURSEFORGE_NOT_CONFIGURED"
      );
    }
    return env.curseforgeApiKey;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "User-Agent": "CraftDock/1.0",
      ...extra,
    };
  }

  private async fetchCurseForge(
    path: string,
    init?: RequestInit & { params?: Record<string, string> }
  ): Promise<Response> {
    const url = new URL(`${BASE_URL}${path}`);
    if (init?.params) {
      Object.entries(init.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const { params: _params, ...fetchInit } = init ?? {};
    return fetch(url.toString(), {
      ...fetchInit,
      headers: this.headers(fetchInit.headers),
    });
  }

  private async request<T>(path: string, init?: RequestInit & { params?: Record<string, string> }): Promise<T> {
    const res = await this.fetchCurseForge(path, init);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("CurseForge API error", { path, status: res.status, body: body.slice(0, 200) });
      throw new AppError(
        res.status,
        `CurseForge API error: ${res.statusText}${body ? ` — ${body.slice(0, 120)}` : ""}`,
        "CURSEFORGE_ERROR"
      );
    }
    const json = (await res.json()) as { data: T };
    return json.data;
  }

  private async postRequest<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  private mapFiles(files: CfFile[]): ModpackVersion[] {
    const installable = files.filter(
      (f) =>
        f.isServerPack === true ||
        f.fileName.endsWith(".zip") ||
        f.fileName.endsWith(".mrpack") ||
        /server/i.test(f.fileName)
    );
    const list = installable.length > 0 ? installable : files;
    return list.map((f) => ({
        id: f.id,
        name: f.displayName,
        gameVersion: f.gameVersions[0] ?? "unknown",
        fileName: f.fileName,
        downloadUrl: f.downloadUrl ?? "",
      }));
  }

  async searchModpacks(query: string, index = 0, pageSize = 20): Promise<ModpackSearchResult[]> {
    const data = await this.request<
      {
        id: number;
        name: string;
        slug: string;
        summary: string;
        downloadCount: number;
        logo?: { thumbnailUrl: string };
      }[]
    >("/mods/search", {
      params: {
        gameId: "432",
        classId: "4471",
        searchFilter: query,
        index: String(index),
        pageSize: String(pageSize),
        sortField: "2",
        sortOrder: "desc",
      },
    });

    return data.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      summary: m.summary,
      downloadCount: m.downloadCount,
      logoUrl: m.logo?.thumbnailUrl,
    }));
  }

  /**
   * List installable versions. Tries /files first; on 403 uses /mods/{id} latestFiles
   * (some API keys can search but not list full file history).
   */
  async getModpackFiles(modId: number): Promise<ModpackVersion[]> {
    const res = await this.fetchCurseForge(`/mods/${modId}/files`, {
      params: { pageSize: "50", index: "0" },
    });

    if (res.ok) {
      const json = (await res.json()) as { data: CfFile[] };
      const mapped = this.mapFiles(json.data);
      if (mapped.length > 0) return mapped;
    } else if (res.status !== 403 && res.status !== 404) {
      const body = await res.text().catch(() => "");
      throw new AppError(
        res.status,
        `CurseForge API error: ${res.statusText}${body ? ` — ${body.slice(0, 120)}` : ""}`,
        "CURSEFORGE_ERROR"
      );
    } else {
      logger.info("CurseForge /files restricted, using mod latestFiles fallback", {
        modId,
        status: res.status,
      });
    }

    const mod = await this.request<CfMod>(`/mods/${modId}`);
    let files = mod.latestFiles ?? [];

    if (files.length === 0 && mod.latestFilesIndexes?.length) {
      const fileIds = mod.latestFilesIndexes.map((i) => i.fileId);
      files = await this.postRequest<CfFile[]>("/mods/files", { fileIds });
    }

    const mapped = this.mapFiles(files);
    if (mapped.length === 0) {
      throw new AppError(
        404,
        "No installable versions found for this modpack",
        "MODPACK_FILES_NOT_FOUND"
      );
    }
    return mapped;
  }

  async downloadModpackFile(modId: number, fileId: number): Promise<{ buffer: Buffer; fileName: string }> {
    const files = await this.postRequest<CfFile[]>("/mods/files", { fileIds: [fileId] });
    const file = files[0];
    if (!file) throw new AppError(404, "Modpack file not found", "MODPACK_FILE_NOT_FOUND");

    let downloadUrl = file.downloadUrl;
    if (!downloadUrl) {
      downloadUrl = await this.request<string>(`/mods/${modId}/files/${fileId}/download-url`);
    }

    const res = await fetch(downloadUrl, {
      headers: { "x-api-key": this.apiKey, "User-Agent": "CraftDock/1.0" },
    });
    if (!res.ok) {
      throw new AppError(502, `Failed to download modpack file: ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, fileName: file.fileName };
  }

  async cacheModpack(modId: number): Promise<void> {
    const mod = await this.request<{ id: number; name: string; slug: string }>(`/mods/${modId}`);
    await prisma.modpackCache.upsert({
      where: { curseId: modId },
      create: { curseId: modId, name: mod.name, slug: mod.slug, data: mod as object },
      update: { name: mod.name, slug: mod.slug, data: mod as object },
    });
  }
}

export const curseForgeService = new CurseForgeService();
