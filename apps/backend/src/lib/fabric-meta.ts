/** Resolve Fabric server jar download URL from meta.fabricmc.net */

interface FabricLoaderEntry {
  loader?: { version?: string; stable?: boolean };
}

interface FabricInstallerEntry {
  version?: string;
  stable?: boolean;
}

function pickLoaderVersion(entries: FabricLoaderEntry[], preferred?: string): string | undefined {
  const want = preferred?.trim();
  if (want && want !== "*") return want;

  const stable = entries.find((e) => e.loader?.stable);
  return stable?.loader?.version ?? entries[0]?.loader?.version;
}

function pickInstallerVersion(entries: FabricInstallerEntry[]): string | undefined {
  const stable = entries.find((e) => e.stable);
  return stable?.version ?? entries[0]?.version;
}

/** Resolve Fabric server jar download URL from meta.fabricmc.net */
export async function getFabricServerJarUrl(
  minecraftVersion: string,
  loaderVersion?: string
): Promise<string> {
  let loader = loaderVersion?.trim();
  if (!loader || loader === "*") {
    const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}`);
    if (!res.ok) {
      throw new Error(`No Fabric loader for Minecraft ${minecraftVersion} (HTTP ${res.status})`);
    }
    const entries = (await res.json()) as FabricLoaderEntry[];
    loader = pickLoaderVersion(entries);
    if (!loader) {
      throw new Error(`No Fabric loader found for Minecraft ${minecraftVersion}`);
    }
  }

  const installerRes = await fetch("https://meta.fabricmc.net/v2/versions/installer");
  if (!installerRes.ok) throw new Error("Failed to fetch Fabric installer metadata");
  const installers = (await installerRes.json()) as FabricInstallerEntry[];
  const installer = pickInstallerVersion(installers);
  if (!installer) throw new Error("No Fabric installer version available");

  return `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${loader}/${installer}/server/jar`;
}
