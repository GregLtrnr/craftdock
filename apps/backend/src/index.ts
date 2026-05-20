import http from "http";
import path from "path";
import fs from "fs/promises";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { Server as SocketServer } from "socket.io";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { csrfProtection } from "./middleware/csrf";
import { setupConsoleSocket } from "./socket/console.socket";
import { openApiSpec } from "./openapi/spec";
import { seedAdminIfNeeded } from "./services/auth.service";
import { startScheduler } from "./jobs/scheduler";
import { logger } from "./lib/logger";

async function bootstrap() {
  await fs.mkdir(env.dataDir, { recursive: true });
  await fs.mkdir(env.backupDir, { recursive: true });

  await seedAdminIfNeeded();
  startScheduler();

  const app = express();
  const server = http.createServer(app);

  const socketCorsOrigins = [env.frontendUrl, env.frontendUrl.replace(/:3000$/, ":4000")];
  const io = new SocketServer(server, {
    cors: {
      origin: socketCorsOrigins,
      credentials: true,
    },
    path: "/socket.io",
  });
  setupConsoleSocket(io);

  app.use(helmet({ contentSecurityPolicy: env.isDev ? false : undefined }));
  app.use(
    cors({
      origin: [env.frontendUrl, env.frontendUrl.replace(/:3000$/, ":4000")],
      credentials: true,
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  // Only limit writes — panel polls GET /stats every few seconds and would hit 429 otherwise
  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMax,
      standardHeaders: true,
      skip: (req) =>
        req.method === "GET" ||
        req.method === "HEAD" ||
        req.path === "/api/auth/csrf" ||
        req.path === "/api/system/health",
    })
  );

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use("/api", csrfProtection, apiRoutes);
  app.use(errorHandler);

  server.listen(env.port, env.host, () => {
    logger.info(`CraftDock API listening on ${env.host}:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start CraftDock:", err);
  process.exit(1);
});
