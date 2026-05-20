import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import tar from "tar";
import { unzipSync } from "fflate";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

async function extractZipWithFflate(archivePath: string, destDir: string): Promise<void> {
  const data = await fs.readFile(archivePath);
  const entries = unzipSync(new Uint8Array(data));

  for (const [relPath, content] of Object.entries(entries) as [string, Uint8Array][]) {
    if (!content?.length || relPath.endsWith("/")) continue;
    const dest = path.join(destDir, relPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(content));
  }
}

/** Extract .zip / .mrpack (zip) or .tar.gz into destDir. */
export async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  const lower = archivePath.toLowerCase();
  if (lower.endsWith(".zip") || lower.endsWith(".mrpack")) {
    try {
      await execFileAsync("unzip", ["-o", archivePath, "-d", destDir], {
        maxBuffer: 128 * 1024 * 1024,
      });
      return;
    } catch (err) {
      logger.warn("unzip CLI failed, using Node fallback (fflate)", {
        err: (err as Error).message,
      });
      await extractZipWithFflate(archivePath, destDir);
      return;
    }
  }
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".tar")) {
    await tar.x({ file: archivePath, cwd: destDir });
    return;
  }
  throw new Error(`Unsupported archive format: ${path.basename(archivePath)}`);
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => undefined);
}
