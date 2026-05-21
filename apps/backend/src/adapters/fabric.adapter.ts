import { BaseAdapter } from "./base.adapter";
import { getFabricServerJarUrl } from "../lib/fabric-meta";

export class FabricAdapter extends BaseAdapter {
  readonly type = "FABRIC";

  async getDownloadUrl(version: string): Promise<string> {
    return getFabricServerJarUrl(version);
  }
}
