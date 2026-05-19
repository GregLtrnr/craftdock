import path from "path";
import fs from "fs/promises";
import { BaseAdapter, type AdapterInstallContext } from "./base.adapter";

export class FabricAdapter extends BaseAdapter {
  readonly type = "FABRIC";

  async getDownloadUrl(version: string): Promise<string> {
    const metaRes = await fetch(
      `https://meta.fabricmc.net/v2/versions/loader/${version}`
    );
    if (!metaRes.ok) throw new Error(`Fabric loader for ${version} not found`);
    const loaders = (await metaRes.json()) as { version: string }[];
    const loader = loaders[0]?.version;
    const installerRes = await fetch(
      `https://meta.fabricmc.net/v2/versions/installer`
    );
    const installers = (await installerRes.json()) as { version: string }[];
    const installer = installers[0]?.version;
    return `https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${installer}/server/jar`;
  }

  override async install(ctx: AdapterInstallContext) {
    const result = await super.install(ctx);
    // Fabric server jar is standalone
    return result;
  }
}
