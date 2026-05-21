import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { env } from "../config/env";
import { syncServerRuntimeConfig, writeNeoForgeUserJvmArgs } from "./server-config";
import {
  neoForgeInstallerUrl,
  resolveNeoForgeVersion,
} from "./neoforge-meta";

const INSTALLER_TIMEOUT_MS = 15 * 60 * 1000;

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadInstaller(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NeoForge installer download failed: HTTP ${res.status}`);
  }
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function runNeoForgeInstaller(installerPath: string, cwd: string): Promise<void> {
  const java = path.join(env.javaHome, "bin", "java");
  return new Promise((resolve, reject) => {
    const proc = spawn(java, ["-jar", installerPath, "--installServer"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    const append = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 8000) output = output.slice(-8000);
    };
    proc.stdout?.on("data", append);
    proc.stderr?.on("data", append);

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("NeoForge installer timed out after 15 minutes"));
    }, INSTALLER_TIMEOUT_MS);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `NeoForge installer exited with code ${code}${output ? `: ${output.trim()}` : ""}`
          )
        );
      }
    });
  });
}

export async function installNeoForgeServer(
  dataPath: string,
  opts: {
    minecraftVersion: string;
    loaderVersion?: string;
    port: number;
    ramMb: number;
  },
  log?: (msg: string) => Promise<void>
): Promise<{ neoForgeVersion: string }> {
  await fs.mkdir(dataPath, { recursive: true });

  const neoForgeVersion = await resolveNeoForgeVersion(
    opts.loaderVersion,
    opts.minecraftVersion
  );
  await log?.(`NeoForge ${neoForgeVersion} (Minecraft ${opts.minecraftVersion})`);

  const installerName = `neoforge-${neoForgeVersion}-installer.jar`;
  const installerPath = path.join(dataPath, installerName);
  const url = neoForgeInstallerUrl(neoForgeVersion);

  await log?.("Downloading NeoForge installer…");
  await downloadInstaller(url, installerPath);

  await log?.("Running NeoForge installer (may take several minutes)…");
  await runNeoForgeInstaller(installerPath, dataPath);
  await fs.unlink(installerPath).catch(() => undefined);

  if (!(await fileExists(path.join(dataPath, "run.sh")))) {
    throw new Error("NeoForge install finished but run.sh was not created");
  }

  await writeNeoForgeUserJvmArgs(dataPath, opts.ramMb);
  await fs.writeFile(
    path.join(dataPath, "eula.txt"),
    "eula=false\n# Accept EULA from CraftDock panel\n"
  );
  await syncServerRuntimeConfig(dataPath, { port: opts.port, ramMb: opts.ramMb });

  await log?.("NeoForge server files installed");
  return { neoForgeVersion };
}
