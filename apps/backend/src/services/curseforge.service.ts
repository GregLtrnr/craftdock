import { env } from "../config/env";
import { AppError } from "../lib/errors";
import type { ModpackSearchResult, ModpackVersion } from "@craftdock/shared";
import { prisma } from "../lib/prisma";

const BASE_URL = "https://api.curseforge.com/v1";

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

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": this.apiKey, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new AppError(res.status, `CurseForge API error: ${res.statusText}`, "CURSEFORGE_ERROR");
    }
    const json = (await res.json()) as { data: T };
    return json.data;
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
      gameId: "432",
      classId: "4471",
      searchFilter: query,
      index: String(index),
      pageSize: String(pageSize),
      sortField: "2",
      sortOrder: "desc",
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

  async getModpackFiles(modId: number): Promise<ModpackVersion[]> {
    const files = await this.request<
      {
        id: number;
        displayName: string;
        gameVersions: string[];
        fileName: string;
        downloadUrl: string;
      }[]
    >(`/mods/${modId}/files`, { pageSize: "50" });

    return files
      .filter((f) => f.fileName.endsWith(".zip") || f.fileName.includes("server"))
      .map((f) => ({
        id: f.id,
        name: f.displayName,
        gameVersion: f.gameVersions[0] ?? "unknown",
        fileName: f.fileName,
        downloadUrl: f.downloadUrl,
      }));
  }

  async downloadModpackFile(fileId: number): Promise<{ buffer: Buffer; fileName: string }> {
    const file = await this.request<{
      fileName: string;
      downloadUrl: string;
    }>(`/mods/files/${fileId}`);

    const res = await fetch(file.downloadUrl, {
      headers: { "x-api-key": this.apiKey },
    });
    if (!res.ok) throw new AppError(502, "Failed to download modpack file");
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
