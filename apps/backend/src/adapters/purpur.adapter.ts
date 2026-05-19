import { BaseAdapter } from "./base.adapter";

export class PurpurAdapter extends BaseAdapter {
  readonly type = "PURPUR";

  async getDownloadUrl(version: string): Promise<string> {
    const res = await fetch(
      `https://api.purpurmc.org/v2/purpur/${version}/latest/download`
    );
    if (!res.ok) throw new Error(`Purpur version ${version} not found`);
    return res.url;
  }
}
