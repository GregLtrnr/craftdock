import { BaseAdapter } from "./base.adapter";

export class PaperAdapter extends BaseAdapter {
  readonly type = "PAPER";

  async getDownloadUrl(version: string): Promise<string> {
    const res = await fetch(
      `https://api.papermc.io/v2/projects/paper/versions/${version}`
    );
    if (!res.ok) throw new Error(`Paper version ${version} not found`);
    const data = (await res.json()) as { builds: number[] };
    const build = data.builds[data.builds.length - 1];
    return `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build}/downloads/paper-${version}-${build}.jar`;
  }
}
