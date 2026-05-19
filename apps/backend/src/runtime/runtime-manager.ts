import { NativeRuntime } from "./native.runtime";
import { DockerRuntime } from "./docker.runtime";
import type { RuntimeInstance, StartOptions } from "./types";
import { prisma } from "../lib/prisma";

const instances = new Map<string, RuntimeInstance>();

export function getRuntime(serverId: string): RuntimeInstance | undefined {
  return instances.get(serverId);
}

export async function createRuntime(
  serverId: string,
  mode: "NATIVE" | "DOCKER",
  options: StartOptions,
  containerId?: string | null
): Promise<RuntimeInstance> {
  const existing = instances.get(serverId);
  if (existing) return existing;

  const runtime: RuntimeInstance =
    mode === "DOCKER"
      ? new DockerRuntime(serverId, options, containerId)
      : new NativeRuntime(serverId, options);

  instances.set(serverId, runtime);
  return runtime;
}

export function removeRuntime(serverId: string): void {
  instances.delete(serverId);
}

export async function handleCrash(serverId: string): Promise<void> {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server?.autoRestart) return;
  const runtime = instances.get(serverId);
  if (runtime && !runtime.isRunning()) {
    await prisma.server.update({
      where: { id: serverId },
      data: { status: "CRASHED" },
    });
    setTimeout(async () => {
      try {
        await runtime.start();
        await prisma.server.update({
          where: { id: serverId },
          data: { status: "RUNNING", startedAt: new Date() },
        });
      } catch {
        /* logged elsewhere */
      }
    }, 5000);
  }
}
