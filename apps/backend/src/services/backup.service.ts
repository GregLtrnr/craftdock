import path from "path";
import fs from "fs/promises";
import { createGzip } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import tar from "tar";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { getServer } from "./server.service";
import { stopServer, startServer } from "./server.service";
import { getRuntime } from "../runtime/runtime-manager";

export async function createBackup(serverId: string, name?: string): Promise<string> {
  const server = await getServer(serverId);
  const backupName = name ?? `backup-${Date.now()}`;
  const backupPath = path.join(env.backupDir, server.uuid, `${backupName}.tar.gz`);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });

  const backup = await prisma.backup.create({
    data: {
      serverId,
      name: backupName,
      filePath: backupPath,
      status: "RUNNING",
    },
  });

  try {
    await tar.c({ gzip: true, file: backupPath, cwd: server.dataPath }, ["."]);
    const stat = await fs.stat(backupPath);
    await prisma.backup.update({
      where: { id: backup.id },
      data: {
        status: "COMPLETED",
        sizeBytes: BigInt(stat.size),
        completedAt: new Date(),
      },
    });
    return backup.id;
  } catch (err) {
    await prisma.backup.update({
      where: { id: backup.id },
      data: { status: "FAILED" },
    });
    throw err;
  }
}

export async function restoreBackup(backupId: string): Promise<void> {
  const backup = await prisma.backup.findUnique({
    where: { id: backupId },
    include: { server: true },
  });
  if (!backup || backup.status !== "COMPLETED") throw new Error("Backup not found");

  const wasRunning = getRuntime(backup.serverId)?.isRunning();
  if (wasRunning) await stopServer(backup.serverId);

  await tar.x({ file: backup.filePath, cwd: backup.server.dataPath });

  if (wasRunning) await startServer(backup.serverId);
}

export async function listBackups(serverId: string) {
  return prisma.backup.findMany({
    where: { serverId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteBackup(backupId: string): Promise<void> {
  const backup = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!backup) return;
  await fs.unlink(backup.filePath).catch(() => undefined);
  await prisma.backup.delete({ where: { id: backupId } });
}

export async function pruneOldBackups(): Promise<void> {
  const cutoff = new Date(Date.now() - env.backupRetentionDays * 24 * 60 * 60 * 1000);
  const old = await prisma.backup.findMany({
    where: { createdAt: { lt: cutoff }, isScheduled: true },
  });
  for (const b of old) await deleteBackup(b.id);
}
