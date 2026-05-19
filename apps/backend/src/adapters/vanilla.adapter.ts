import { BaseAdapter } from "./base.adapter";

/** Vanilla Minecraft server from Mojang version manifest */
export class VanillaAdapter extends BaseAdapter {
  readonly type = "VANILLA";

  async getDownloadUrl(version: string): Promise<string> {
    const manifestRes = await fetch(
      "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
    );
    if (!manifestRes.ok) throw new Error("Failed to fetch Mojang manifest");
    const manifest = (await manifestRes.json()) as {
      versions: { id: string; url: string }[];
    };
    const ver = manifest.versions.find((v) => v.id === version);
    if (!ver) throw new Error(`Version ${version} not found`);
    const verRes = await fetch(ver.url);
    const verData = (await verRes.json()) as {
      downloads: { server: { url: string } };
    };
    return verData.downloads.server.url;
  }
}
