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

/** Filled from search results — survives 403 on /mods/{id} and /files. */
const versionsByModId = new Map<number, ModpackVersion[]>();
const fileMetaByFileId = new Map<number, { modId: number; fileName: string }>();

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

  private headers(): Record<string, string> {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "User-Agent": "CraftDock/1.0",
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
    const { params: _params, headers: _headers, ...fetchInit } = init ?? {};
    return fetch(url.toString(), {
      ...fetchInit,
      headers: this.headers(),
    });
  }

  private async readData<T>(res: Response): Promise<T | null> {
    if (!res.ok) return null;
    const json = (await res.json()) as { data: T };
    return json.data;
  }

  private cacheVersions(modId: number, files: CfFile[]): ModpackVersion[] {
    const versions = this.mapFiles(files);
    if (versions.length > 0) {
      versionsByModId.set(modId, versions);
      for (const v of versions) {
        fileMetaByFileId.set(v.id, { modId, fileName: v.fileName });
      }
    }
    return versions;
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

  private versionsFromIndexes(modId: number, mod: CfMod): ModpackVersion[] {
    if (!mod.latestFilesIndexes?.length) return [];
    return mod.latestFilesIndexes.map((i) => ({
      id: i.fileId,
      name: i.filename,
      gameVersion: i.gameVersion,
      fileName: i.filename,
      downloadUrl: "",
    }));
  }

  private async resolveMod(modId: number, slug?: string): Promise<CfMod | null> {
    const postRes = await this.fetchCurseForge("/mods", {
      method: "POST",
      body: JSON.stringify({ modIds: [modId] }),
    });
    const fromPost = await this.readData<CfMod[]>(postRes);
    if (fromPost?.[0]) return fromPost[0];

    if (slug) {
      const searchRes = await this.fetchCurseForge("/mods/search", {
        params: { gameId: "432", classId: "4471", slug },
      });
      const fromSlug = await this.readData<CfMod[]>(searchRes);
      if (fromSlug?.[0]) return fromSlug[0];
    }

    const getRes = await this.fetchCurseForge(`/mods/${modId}`);
    return this.readData<CfMod>(getRes);
  }

  private extractFilesFromMod(mod: CfMod): CfFile[] {
    if (mod.latestFiles?.length) return mod.latestFiles;
    return (mod.latestFilesIndexes ?? []).map((i) => ({
      id: i.fileId,
      displayName: i.filename,
      gameVersions: [i.gameVersion],
      fileName: i.filename,
    }));
  }

  private forgeCdnUrl(fileId: number, fileName: string): string {
    const folder = Math.floor(fileId / 1000);
    const leaf = fileId % 1000;
    const encoded = encodeURIComponent(fileName);
    return `https://mediafiles.forgecdn.net/files/${folder}/${leaf}/${encoded}`;
  }

  async searchModpacks(query: string, index = 0, pageSize = 20): Promise<ModpackSearchResult[]> {
    const res = await this.fetchCurseForge("/mods/search", {
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
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AppError(
        res.status,
        `CurseForge API error: ${res.statusText}${body ? ` — ${body.slice(0, 120)}` : ""}`,
        "CURSEFORGE_ERROR"
      );
    }

    const data = ((await res.json()) as { data: CfMod[] }).data;

    return data.map((m) => {
      const rawFiles = this.extractFilesFromMod(m);
      const versions =
        rawFiles.length > 0
          ? this.cacheVersions(m.id, rawFiles)
          : this.versionsFromIndexes(m.id, m);

      if (versions.length > 0) {
        versionsByModId.set(m.id, versions);
        for (const v of versions) {
          fileMetaByFileId.set(v.id, { modId: m.id, fileName: v.fileName });
        }
      }

      return {
        id: m.id,
        name: m.name,
        slug: m.slug,
        summary: (m as CfMod & { summary?: string }).summary ?? "",
        downloadCount: (m as CfMod & { downloadCount?: number }).downloadCount ?? 0,
        logoUrl: (m as CfMod & { logo?: { thumbnailUrl: string } }).logo?.thumbnailUrl,
        versions: versions.length > 0 ? versions : undefined,
      };
    });
  }

  async getModpackFiles(modId: number, slug?: string): Promise<ModpackVersion[]> {
    const cached = versionsByModId.get(modId);
    if (cached?.length) return cached;

    const listRes = await this.fetchCurseForge(`/mods/${modId}/files`, {
      params: { pageSize: "50", index: "0" },
    });
    if (listRes.ok) {
      const files = ((await listRes.json()) as { data: CfFile[] }).data;
      const mapped = this.cacheVersions(modId, files);
      if (mapped.length > 0) return mapped;
    } else if (listRes.status !== 403 && listRes.status !== 404) {
      const body = await listRes.text().catch(() => "");
      throw new AppError(
        listRes.status,
        `CurseForge API error: ${listRes.statusText}${body ? ` — ${body.slice(0, 120)}` : ""}`,
        "CURSEFORGE_ERROR"
      );
    }

    const mod = await this.resolveMod(modId, slug);
    if (mod) {
      let files = this.extractFilesFromMod(mod);
      if (files.length === 0) {
        const fromIndexes = this.versionsFromIndexes(modId, mod);
        if (fromIndexes.length > 0) {
          versionsByModId.set(modId, fromIndexes);
          return fromIndexes;
        }
      }

      if (files.length > 0 && !mod.latestFiles?.length) {
        const detailRes = await this.fetchCurseForge("/mods/files", {
          method: "POST",
          body: JSON.stringify({ fileIds: files.map((f) => f.id) }),
        });
        const detailed = await this.readData<CfFile[]>(detailRes);
        if (detailed?.length) files = detailed;
      }

      const mapped = this.cacheVersions(modId, files);
      if (mapped.length > 0) return mapped;
    }

    throw new AppError(
      404,
      "No versions available. Run a new search, then select the modpack again (versions are loaded from search results).",
      "MODPACK_FILES_NOT_FOUND"
    );
  }

  async downloadModpackFile(modId: number, fileId: number): Promise<{ buffer: Buffer; fileName: string }> {
    const meta = fileMetaByFileId.get(fileId);
    const fileName = meta?.fileName;

    const detailRes = await this.fetchCurseForge("/mods/files", {
      method: "POST",
      body: JSON.stringify({ fileIds: [fileId] }),
    });
    const files = await this.readData<CfFile[]>(detailRes);
    const file = files?.[0];
    const resolvedName = file?.fileName ?? fileName;
    if (!resolvedName) {
      throw new AppError(404, "Modpack file not found — select the modpack from search first", "MODPACK_FILE_NOT_FOUND");
    }

    const urls: string[] = [];
    if (file?.downloadUrl) urls.push(file.downloadUrl);

    const urlRes = await this.fetchCurseForge(`/mods/${modId}/files/${fileId}/download-url`);
    const apiUrl = await this.readData<string>(urlRes);
    if (apiUrl) urls.push(apiUrl);

    urls.push(this.forgeCdnUrl(fileId, resolvedName));
    urls.push(
      `https://edge.forgecdn.net/files/${Math.floor(fileId / 1000)}/${fileId % 1000}/${encodeURIComponent(resolvedName)}`
    );

    let lastError = "";
    for (const url of urls) {
      const res = await fetch(url, {
        headers: { "x-api-key": this.apiKey, "User-Agent": "CraftDock/1.0" },
        redirect: "follow",
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        return { buffer, fileName: resolvedName };
      }
      lastError = `${res.status} ${res.statusText}`;
      logger.warn("Modpack download attempt failed", { url: url.slice(0, 80), lastError });
    }

    throw new AppError(502, `Failed to download modpack file: ${lastError}`);
  }

  async cacheModpack(modId: number): Promise<void> {
    const mod = await this.resolveMod(modId);
    if (!mod) return;
    await prisma.modpackCache.upsert({
      where: { curseId: modId },
      create: { curseId: modId, name: mod.name, slug: mod.slug, data: mod as object },
      update: { name: mod.name, slug: mod.slug, data: mod as object },
    });
  }
}

export const curseForgeService = new CurseForgeService();
