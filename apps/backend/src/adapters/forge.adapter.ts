import { BaseAdapter } from "./base.adapter";

export class ForgeAdapter extends BaseAdapter {
  readonly type = "FORGE";

  async getDownloadUrl(version: string): Promise<string> {
    // Forge uses installer — simplified: use Maven promotion API
    const [mc, forge] = version.includes("-") ? version.split("-") : [version, ""];
    const res = await fetch(
      `https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json`
    );
    const promos = (await res.json()) as { promos: Record<string, string> };
    const key = `${mc}-recommended`;
    const forgeVer = forge || promos.promos[key];
    if (!forgeVer) throw new Error(`Forge version for ${mc} not found`);
    return `https://maven.minecraftforge.net/net/minecraftforge/forge/${mc}-${forgeVer}/forge-${mc}-${forgeVer}-installer.jar`;
  }
}
