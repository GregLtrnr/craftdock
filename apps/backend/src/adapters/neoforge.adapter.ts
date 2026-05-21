import path from "path";
import fs from "fs/promises";
import { BaseAdapter, type AdapterInstallContext } from "./base.adapter";
import { installNeoForgeServer } from "../lib/neoforge-install";
import { neoForgeInstallerUrl, resolveNeoForgeVersion } from "../lib/neoforge-meta";

export class NeoForgeAdapter extends BaseAdapter {
  readonly type = "NEOFORGE";

  override async install(ctx: AdapterInstallContext) {
    await fs.mkdir(ctx.dataPath, { recursive: true });
    await installNeoForgeServer(ctx.dataPath, {
      minecraftVersion: ctx.minecraftVersion,
      port: ctx.port,
      ramMb: ctx.ramMb,
    });
    const startupScript = path.join(ctx.dataPath, "start.sh");
    return { jarFile: "run.sh", startupScript };
  }

  async getDownloadUrl(version: string): Promise<string> {
    const neoForgeVersion = await resolveNeoForgeVersion(version, version);
    return neoForgeInstallerUrl(neoForgeVersion);
  }
}
