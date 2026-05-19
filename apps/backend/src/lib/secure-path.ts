import path from "path";
import { AppError } from "./errors";

/**
 * Resolves a user-provided relative path within a server root.
 * Prevents directory traversal attacks.
 */
export function resolveSafePath(serverRoot: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.includes("\0")) {
    throw new AppError(400, "Invalid path", "INVALID_PATH");
  }
  const resolved = path.resolve(serverRoot, normalized);
  const rootResolved = path.resolve(serverRoot);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new AppError(403, "Path traversal denied", "PATH_TRAVERSAL");
  }
  return resolved;
}

export function toRelativePath(serverRoot: string, absolutePath: string): string {
  const rel = path.relative(serverRoot, absolutePath);
  return rel === "" ? "." : rel.replace(/\\/g, "/");
}
