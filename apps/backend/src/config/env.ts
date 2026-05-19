import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-in-production-32chars"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  sessionSecret: required("SESSION_SECRET", "dev-session-secret"),
  csrfSecret: required("CSRF_SECRET", "dev-csrf-secret"),
  dataDir: process.env.DATA_DIR ?? path.join(process.cwd(), "data/servers"),
  backupDir: process.env.BACKUP_DIR ?? path.join(process.cwd(), "data/backups"),
  javaHome: process.env.JAVA_HOME ?? "/usr/lib/jvm/java-21-openjdk-amd64",
  curseforgeApiKey: process.env.CURSEFORGE_API_KEY ?? "",
  dockerEnabled: process.env.DOCKER_ENABLED === "true",
  dockerNetwork: process.env.DOCKER_NETWORK ?? "craftdock-net",
  dockerImage: process.env.DOCKER_IMAGE ?? "itzg/minecraft-server:latest",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@localhost",
  adminPassword: process.env.ADMIN_PASSWORD ?? "changeme123",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  backupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS ?? "14", 10),
  backupCron: process.env.BACKUP_CRON ?? "0 3 * * *",
  nodeId: process.env.NODE_ID ?? "local",
  isDev: (process.env.NODE_ENV ?? "development") !== "production",
};
