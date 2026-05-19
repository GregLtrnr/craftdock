import { BaseAdapter } from "./base.adapter";

export class NeoForgeAdapter extends BaseAdapter {
  readonly type = "NEOFORGE";

  async getDownloadUrl(version: string): Promise<string> {
    const res = await fetch(
      `https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge`
    );
    if (!res.ok) throw new Error("Failed to fetch NeoForge versions");
    const versions = (await res.json()) as string[];
    const match = versions.find((v) => v.startsWith(version)) ?? versions[versions.length - 1];
    return `https://maven.neoforged.net/releases/net/neoforged/neoforge/${match}/neoforge-${match}-installer.jar`;
  }
}
