import fs from "fs/promises";
import path from "path";
import { getServer } from "./server.service";
import { resolveSafePath, toRelativePath } from "../lib/secure-path";
import { sanitizeFilename } from "../lib/sanitize";
import { AppError } from "../lib/errors";
import type { FileEntry } from "@craftdock/shared";
import { ALLOWED_UPLOAD_EXTENSIONS } from "@craftdock/shared";

export async function listFiles(serverId: string, relativePath = "."): Promise<FileEntry[]> {
  const server = await getServer(serverId);
  const dir = resolveSafePath(server.dataPath, relativePath);
  const stat = await fs.stat(dir).catch(() => {
    throw new AppError(404, "Path not found");
  });
  if (!stat.isDirectory()) throw new AppError(400, "Not a directory");

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result: FileEntry[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const st = await fs.stat(full);
    result.push({
      name: entry.name,
      path: toRelativePath(server.dataPath, full),
      isDirectory: entry.isDirectory(),
      size: st.size,
      modifiedAt: st.mtime.toISOString(),
    });
  }

  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFile(serverId: string, relativePath: string): Promise<string> {
  const server = await getServer(serverId);
  const filePath = resolveSafePath(server.dataPath, relativePath);
  const stat = await fs.stat(filePath);
  if (stat.size > 10 * 1024 * 1024) {
    throw new AppError(413, "File too large to edit in browser");
  }
  return fs.readFile(filePath, "utf8");
}

export async function writeFile(
  serverId: string,
  relativePath: string,
  content: string
): Promise<void> {
  const server = await getServer(serverId);
  const filePath = resolveSafePath(server.dataPath, relativePath);
  await fs.writeFile(filePath, content, "utf8");
}

export async function deletePath(serverId: string, relativePath: string): Promise<void> {
  const server = await getServer(serverId);
  const target = resolveSafePath(server.dataPath, relativePath);
  if (target === server.dataPath) {
    throw new AppError(403, "Cannot delete server root");
  }
  await fs.rm(target, { recursive: true, force: true });
}

export async function createDirectory(serverId: string, relativePath: string): Promise<void> {
  const server = await getServer(serverId);
  const dir = resolveSafePath(server.dataPath, relativePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function createFile(serverId: string, relativePath: string): Promise<void> {
  const server = await getServer(serverId);
  const filePath = resolveSafePath(server.dataPath, relativePath);
  await fs.writeFile(filePath, "", { flag: "wx" }).catch(() => {
    throw new AppError(409, "File already exists");
  });
}

export function validateUpload(filename: string): void {
  const safe = sanitizeFilename(filename);
  const ext = path.extname(safe).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
    throw new AppError(400, `File type ${ext} not allowed`);
  }
}

export async function getUploadPath(serverId: string, relativeDir: string, filename: string): Promise<string> {
  const server = await getServer(serverId);
  validateUpload(filename);
  const safeName = sanitizeFilename(filename);
  const dir = resolveSafePath(server.dataPath, relativeDir);
  return path.join(dir, safeName);
}
