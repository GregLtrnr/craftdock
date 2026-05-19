/**
 * Sanitize console commands — block shell metacharacters when used in subprocess args.
 * Minecraft console commands are sent as single lines to the server process stdin.
 */
export function sanitizeConsoleCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed || trimmed.length > 512) {
    throw new Error("Invalid command length");
  }
  // Block null bytes and control chars except newline (not allowed in MC commands anyway)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(trimmed)) {
    throw new Error("Invalid characters in command");
  }
  return trimmed;
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\<>:"|?*\x00]/g, "").trim();
  if (!base || base === "." || base === "..") {
    throw new Error("Invalid filename");
  }
  return base;
}
