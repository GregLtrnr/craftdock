const EDITABLE_EXTENSIONS = new Set([
  ".txt",
  ".bat",
  ".sh",
  ".cmd",
  ".ps1",
  ".properties",
  ".json",
  ".json5",
  ".toml",
  ".yml",
  ".yaml",
  ".cfg",
  ".conf",
  ".ini",
  ".log",
  ".md",
  ".mcfunction",
  ".lang",
  ".xml",
  ".zsh",
  ".gradle",
  ".snbt",
  ".opts",
]);

const NON_EDITABLE_EXTENSIONS = new Set([
  ".jar",
  ".zip",
  ".mrpack",
  ".gz",
  ".tar",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".dat",
  ".nbt",
  ".class",
  ".so",
  ".dll",
  ".exe",
  ".bin",
]);

const KNOWN_EDITABLE_NAMES = new Set([
  "eula.txt",
  "user_jvm_args.txt",
  "server.properties",
  "ops.json",
  "whitelist.json",
  "banned-players.json",
  "banned-ips.json",
]);

export function isEditableTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (KNOWN_EDITABLE_NAMES.has(lower)) return true;

  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  if (ext && NON_EDITABLE_EXTENSIONS.has(ext)) return false;
  if (ext && EDITABLE_EXTENSIONS.has(ext)) return true;

  return false;
}
