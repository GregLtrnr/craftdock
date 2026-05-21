const VERSIONS_URL =
  "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

interface NeoForgeVersionsResponse {
  versions?: string[];
}

let cachedVersions: string[] | null = null;

export async function fetchNeoForgeVersions(): Promise<string[]> {
  if (cachedVersions) return cachedVersions;
  const res = await fetch(VERSIONS_URL);
  if (!res.ok) throw new Error(`Failed to fetch NeoForge versions (HTTP ${res.status})`);
  const body = (await res.json()) as NeoForgeVersionsResponse | string[];
  const versions = Array.isArray(body) ? body : (body.versions ?? []);
  if (!versions.length) throw new Error("NeoForge version list is empty");
  cachedVersions = versions;
  return versions;
}

/** Map Minecraft version (e.g. 1.21.1) to NeoForge prefix (e.g. 21.1). */
export function minecraftToNeoForgePrefix(minecraftVersion: string): string | null {
  const parts = minecraftVersion.trim().split(".").map((p) => parseInt(p, 10));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return `${parts[1]}.${parts[2] ?? 0}`;
}

/** NeoForge release id (e.g. 21.1.215), not a Minecraft semver (1.21.1). */
function isNeoForgeVersionToken(token: string): boolean {
  if (token.startsWith("1.")) return false;
  return /^\d+\.\d+\.\d+/.test(token);
}

/** Resolve a NeoForge release version (e.g. 21.1.215). */
export async function resolveNeoForgeVersion(
  loaderVersion?: string,
  minecraftVersion?: string
): Promise<string> {
  const versions = await fetchNeoForgeVersions();
  const stable = versions.filter((v) => !v.includes("beta") && !v.includes("w"));

  const hint = loaderVersion?.trim();
  if (hint) {
    if (stable.includes(hint)) return hint;
    if (isNeoForgeVersionToken(hint)) {
      const patch = stable.filter((v) => v.startsWith(`${hint}.`));
      if (patch.length) return patch[patch.length - 1];
      throw new Error(`NeoForge version ${hint} not found on Maven`);
    }
    const byPrefix = stable.filter((v) => v.startsWith(`${hint}.`));
    if (byPrefix.length) return byPrefix[byPrefix.length - 1];
  }

  const mc = minecraftVersion?.trim();
  if (mc) {
    if (isNeoForgeVersionToken(mc) && stable.includes(mc)) return mc;
    const prefix = minecraftToNeoForgePrefix(mc);
    if (prefix) {
      const matches = stable.filter((v) => v.startsWith(`${prefix}.`));
      if (matches.length) return matches[matches.length - 1];
    }
  }

  throw new Error(
    `Could not resolve NeoForge version` +
      (hint ? ` (loader: ${hint})` : "") +
      (mc ? ` (Minecraft: ${mc})` : "")
  );
}

export function neoForgeInstallerUrl(version: string): string {
  return `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
}
