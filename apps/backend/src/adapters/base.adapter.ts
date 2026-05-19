import path from "path";
import fs from "fs/promises";

export interface AdapterInstallContext {
  dataPath: string;
  minecraftVersion: string;
  ramMb: number;
  port: number;
  javaVersion: string;
}

export interface ServerAdapter {
  readonly type: string;
  install(ctx: AdapterInstallContext): Promise<{ jarFile: string; startupScript: string }>;
  getDownloadUrl(version: string): Promise<string>;
}

export abstract class BaseAdapter implements ServerAdapter {
  abstract readonly type: string;

  async install(ctx: AdapterInstallContext): Promise<{ jarFile: string; startupScript: string }> {
    await fs.mkdir(ctx.dataPath, { recursive: true });
    const jarUrl = await this.getDownloadUrl(ctx.minecraftVersion);
    const jarFile = await this.downloadJar(ctx.dataPath, jarUrl);
    await this.writeEula(ctx.dataPath);
    await this.writeServerProperties(ctx.dataPath, ctx.port);
    const startupScript = await this.writeStartScript(ctx);
    return { jarFile, startupScript };
  }

  abstract getDownloadUrl(version: string): Promise<string>;

  protected async downloadJar(dataPath: string, url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download jar: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const jarName = "server.jar";
    await fs.writeFile(path.join(dataPath, jarName), buf);
    return jarName;
  }

  protected async writeEula(dataPath: string): Promise<void> {
    await fs.writeFile(
      path.join(dataPath, "eula.txt"),
      "eula=false\n# Accept EULA from CraftDock panel\n"
    );
  }

  protected async writeServerProperties(dataPath: string, port: number): Promise<void> {
    const props = [
      `server-port=${port}`,
      "gamemode=survival",
      "difficulty=normal",
      "max-players=20",
      "online-mode=true",
      "pvp=true",
      "spawn-protection=16",
      "view-distance=10",
      "motd=A CraftDock Server",
    ].join("\n");
    await fs.writeFile(path.join(dataPath, "server.properties"), props + "\n");
  }

  protected async writeStartScript(ctx: AdapterInstallContext): Promise<string> {
    const script = `#!/bin/bash
set -e
cd "$(dirname "$0")"
JAVA="${process.env.JAVA_HOME ?? "/usr/lib/jvm/java-21-openjdk-amd64"}/bin/java"
MEM="${ctx.ramMb}"
exec "$JAVA" -Xms\${MEM}M -Xmx\${MEM}M -jar server.jar nogui
`;
    const scriptPath = path.join(ctx.dataPath, "start.sh");
    await fs.writeFile(scriptPath, script, { mode: 0o755 });
    return scriptPath;
  }
}
