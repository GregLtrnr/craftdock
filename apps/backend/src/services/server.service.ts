import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { AppError, assertFound } from "../lib/errors";
import { getAdapter } from "../adapters";
import { createRuntime, getRuntime, removeRuntime } from "../runtime/runtime-manager";
import type { CreateServerInput, UpdateServerInput } from "@craftdock/shared";
import Docker from "dockerode";
import { installModpackToServer } from "./modpack.service";
import type { ModpackSource } from "@craftdock/shared";
import { logger } from "../lib/logger";
export async function listServers(userId: string, role: string) {
  const where =
    role === "ADMIN"
      ? {}
      : {
          OR: [
            { ownerId: userId },
            { permissions: { some: { userId } } },
          ],
        };
  return prisma.server.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { username: true } } },
  });
}

export async function getServer(serverId: string) {
  return assertFound(
    await prisma.server.findUnique({ where: { id: serverId } }),
    "Server not found"
  );
}

export async function createServer(ownerId: string, input: CreateServerInput) {
  const portTaken = await prisma.server.findUnique({ where: { port: input.port } });
  if (portTaken) throw new AppError(409, "Port already in use", "PORT_TAKEN");

  const serverUuid = uuidv4();
  const dataPath = path.join(env.dataDir, serverUuid);
  await fs.mkdir(dataPath, { recursive: true });

  const server = await prisma.server.create({
    data: {
      name: input.name,
      uuid: serverUuid,
      ownerId,
      serverType: input.serverType,
      minecraftVersion: input.minecraftVersion,
      javaVersion: input.javaVersion,
      ramMb: input.ramMb,
      port: input.port,
      runtimeMode: input.runtimeMode,
      autoRestart: input.autoRestart,
      dataPath,
      status: "INSTALLING",
      modpackId: input.modpackId,
      modpackFileId: input.modpackFileId,
      modpackSource: input.modpackSource,
      modpackProjectId: input.modpackProjectId,
      modpackVersionId: input.modpackVersionId,
      modpackSlug: input.modpackSlug,
      modpackName: input.modpackName,
    },
  });

  // Install asynchronously
  installServer(server.id).catch(async (err) => {
    await prisma.server.update({
      where: { id: server.id },
      data: { status: "CRASHED" },
    });
    await prisma.serverLog.create({
      data: {
        serverId: server.id,
        level: "error",
        message: `Install failed: ${(err as Error).message}`,
      },
    });
  });

  return server;
}

async function installServer(serverId: string): Promise<void> {
  const server = await getServer(serverId);

  if (
    server.serverType === "MODPACK" &&
    (server.modpackVersionId || server.modpackFileId != null)
  ) {
    await installModpackServer(server);
    return;
  }

  const adapter = getAdapter(server.serverType);
  await adapter.install({
    dataPath: server.dataPath,
    minecraftVersion: server.minecraftVersion,
    ramMb: server.ramMb,
    port: server.port,
    javaVersion: server.javaVersion,
  });

  await prisma.server.update({
    where: { id: serverId },
    data: { status: "STOPPED" },
  });
}

async function installModpackServer(server: Awaited<ReturnType<typeof getServer>>): Promise<void> {
  const source = (server.modpackSource as ModpackSource) ?? "modrinth";
  const projectId =
    server.modpackProjectId ?? (server.modpackId != null ? String(server.modpackId) : null);
  const versionId =
    server.modpackVersionId ??
    (server.modpackFileId != null ? String(server.modpackFileId) : null);

  if (!projectId || !versionId) {
    throw new Error("Modpack project and version id required");
  }

  await installModpackToServer(source, projectId, versionId, server.dataPath);

  await prisma.server.update({
    where: { id: server.id },
    data: { status: "STOPPED", serverType: "MODPACK" },
  });
}

export async function acceptEula(serverId: string): Promise<void> {
  const server = await getServer(serverId);
  const eulaPath = path.join(server.dataPath, "eula.txt");
  await fs.writeFile(eulaPath, "eula=true\n");
  await prisma.server.update({
    where: { id: serverId },
    data: { eulaAccepted: true },
  });
}

export async function startServer(serverId: string): Promise<void> {
  const server = await getServer(serverId);
  if (!server.eulaAccepted) {
    throw new AppError(400, "EULA must be accepted before starting", "EULA_REQUIRED");
  }

  await prisma.server.update({
    where: { id: serverId },
    data: { status: "STARTING" },
  });

  const runtime = await createRuntime(
    serverId,
    server.runtimeMode,
    {
      serverId,
      dataPath: server.dataPath,
      ramMb: server.ramMb,
      port: server.port,
      javaVersion: server.javaVersion,
      startupScript: path.join(server.dataPath, "start.sh"),
      jarFile: "server.jar",
    },
    server.containerId
  );

  await runtime.start();
  await prisma.server.update({
    where: { id: serverId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function stopServer(serverId: string): Promise<void> {
  const runtime = getRuntime(serverId);
  await prisma.server.update({ where: { id: serverId }, data: { status: "STOPPING" } });
  if (runtime) await runtime.stop();
  await prisma.server.update({ where: { id: serverId }, data: { status: "STOPPED" } });
}

export async function restartServer(serverId: string): Promise<void> {
  const runtime = getRuntime(serverId);
  if (runtime) await runtime.restart();
  else await startServer(serverId);
}

export async function killServer(serverId: string): Promise<void> {
  const runtime = getRuntime(serverId);
  if (runtime) await runtime.kill();
  removeRuntime(serverId);
  await prisma.server.update({ where: { id: serverId }, data: { status: "STOPPED" } });
}

export async function deleteServer(serverId: string): Promise<void> {
  const server = await getServer(serverId);

  try {
    await killServer(serverId);
  } catch (err) {
    logger.warn("Kill before delete failed", { serverId, err: (err as Error).message });
  }

  if (server.containerId && env.dockerEnabled) {
    try {
      const docker = new Docker();
      const container = docker.getContainer(server.containerId);
      await container.stop({ t: 5 }).catch(() => undefined);
      await container.remove({ force: true }).catch(() => undefined);
    } catch (err) {
      logger.warn("Docker cleanup on delete failed", {
        serverId,
        err: (err as Error).message,
      });
    }
  }

  try {
    await fs.rm(server.dataPath, { recursive: true, force: true, maxRetries: 3 });
  } catch (err) {
    logger.warn("Could not remove server data directory", {
      serverId,
      dataPath: server.dataPath,
      err: (err as Error).message,
    });
  }

  await prisma.server.delete({ where: { id: serverId } });
  logger.info("Server deleted", { serverId, name: server.name });
}

export async function updateServer(serverId: string, input: UpdateServerInput) {
  return prisma.server.update({ where: { id: serverId }, data: input });
}

export async function getServerStats(serverId: string) {
  const runtime = getRuntime(serverId);
  if (!runtime) {
    const server = await getServer(serverId);
    return {
      cpuPercent: 0,
      memoryUsedMb: 0,
      memoryLimitMb: server.ramMb,
      diskUsedMb: 0,
      networkRxMb: 0,
      networkTxMb: 0,
      onlinePlayers: 0,
      maxPlayers: server.maxPlayers,
      uptimeSeconds: 0,
      processState: "stopped" as const,
    };
  }
  return runtime.getStats();
}
