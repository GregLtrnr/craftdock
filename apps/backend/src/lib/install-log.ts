import { prisma } from "./prisma";
import { logger } from "./logger";

/** Persist install progress so the panel can show it when status is INSTALLING or CRASHED. */
export async function appendInstallLog(
  serverId: string,
  level: "info" | "warn" | "error",
  message: string
): Promise<void> {
  logger[level](`[install ${serverId.slice(0, 8)}] ${message}`);
  await prisma.serverLog.create({
    data: { serverId, level, message },
  });
}
