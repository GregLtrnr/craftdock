import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import tar from "tar";

const execFileAsync = promisify(execFile);

/** Extract .zip / .mrpack (zip) or .tar.gz into destDir. */
export async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  const lower = archivePath.toLowerCase();
  if (lower.endsWith(".zip") || lower.endsWith(".mrpack")) {
    await execFileAsync("unzip", ["-o", archivePath, "-d", destDir], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return;
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
