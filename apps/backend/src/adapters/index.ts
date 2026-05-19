import type { ServerType } from "@prisma/client";
import type { ServerAdapter } from "./base.adapter";
import { VanillaAdapter } from "./vanilla.adapter";
import { PaperAdapter } from "./paper.adapter";
import { PurpurAdapter } from "./purpur.adapter";
import { FabricAdapter } from "./fabric.adapter";
import { ForgeAdapter } from "./forge.adapter";
import { NeoForgeAdapter } from "./neoforge.adapter";

const adapters: Record<string, ServerAdapter> = {
  VANILLA: new VanillaAdapter(),
  PAPER: new PaperAdapter(),
  PURPUR: new PurpurAdapter(),
  FABRIC: new FabricAdapter(),
  FORGE: new ForgeAdapter(),
  NEOFORGE: new NeoForgeAdapter(),
};

export function getAdapter(serverType: ServerType): ServerAdapter {
  const adapter = adapters[serverType];
  if (!adapter) throw new Error(`No adapter for type ${serverType}`);
  return adapter;
}
