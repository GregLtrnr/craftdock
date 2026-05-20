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
    const loaders = (await res.json()) as { version: string }[];
    loader = loaders[0]?.version;
    if (!loader) throw new Error(`No Fabric loader found for Minecraft ${minecraftVersion}`);
  }

  const installerRes = await fetch("https://meta.fabricmc.net/v2/versions/installer");
  if (!installerRes.ok) throw new Error("Failed to fetch Fabric installer metadata");
  const installers = (await installerRes.json()) as { version: string }[];
  const installer = installers[0]?.version;
  if (!installer) throw new Error("No Fabric installer version available");

  return `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${loader}/${installer}/server/jar`;
}
