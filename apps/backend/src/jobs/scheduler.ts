import cron from "node-cron";
import { env } from "../config/env";
import { pruneOldBackups } from "../services/backup.service";
import { logger } from "../lib/logger";

/**
 * Scheduled tasks — backup retention, future auto-updates, etc.
 */
export function startScheduler(): void {
  cron.schedule(env.backupCron, async () => {
    logger.info("Running scheduled backup retention");
    await pruneOldBackups();
  });

  logger.info("Scheduler started", { backupCron: env.backupCron });
}
