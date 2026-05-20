import { Server as SocketServer } from "socket.io";
import { verifyToken, validateSession } from "../services/auth.service";
import { requireServerAccess } from "../services/permissions.service";
import { getRuntime } from "../runtime/runtime-manager";
import { getServerMetrics } from "../services/monitoring.service";
import { sanitizeConsoleCommand } from "../lib/sanitize";
import { getSocketAuthToken } from "../lib/socket-auth";
import { getServer } from "../services/server.service";

export function setupConsoleSocket(io: SocketServer): void {
  io.use(async (socket, next) => {
    try {
      const token = getSocketAuthToken(socket);
      if (!token) return next(new Error("Unauthorized"));
      let user = await validateSession(token);
      if (!user) user = verifyToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { userId: string; role: string };

    socket.on("console:join", async (serverId: string, cb?: (err?: string) => void) => {
      try {
        await requireServerAccess(user.userId, serverId, user.role, "console");
        const room = `server:${serverId}`;
        await socket.join(room);

        const runtime = getRuntime(serverId);
        const outputHandler = (data: string, type: "stdout" | "stderr") => {
          socket.emit("console:output", { type, data, timestamp: Date.now() });
        };

        if (runtime) {
          runtime.attachOutput(outputHandler);
          socket.data.outputHandler = outputHandler;
          socket.data.serverId = serverId;
          cb?.();
          return;
        }

        const server = await getServer(serverId);
        const hint =
          server.status === "RUNNING"
            ? "Server is marked running but not attached to this panel process. Click Stop, then Start."
            : `Server is ${server.status}. Start the server to see live output.`;
        socket.emit("console:output", {
          type: "stderr",
          data: `\x1b[33m[CraftDock] ${hint}\x1b[0m\r\n`,
          timestamp: Date.now(),
        });
        cb?.();
      } catch (err) {
        cb?.((err as Error).message);
      }
    });

    socket.on("console:command", async (payload: { serverId: string; command: string }) => {
      try {
        await requireServerAccess(user.userId, payload.serverId, user.role, "console");
        const runtime = getRuntime(payload.serverId);
        if (!runtime) throw new Error("Server not running");
        await runtime.sendCommand(sanitizeConsoleCommand(payload.command));
      } catch (err) {
        socket.emit("console:error", { message: (err as Error).message });
      }
    });

    socket.on("console:leave", () => {
      const serverId = socket.data.serverId as string | undefined;
      const handler = socket.data.outputHandler;
      if (serverId && handler) {
        getRuntime(serverId)?.detachOutput(handler);
      }
    });

    socket.on("stats:subscribe", async (serverId: string) => {
      await requireServerAccess(user.userId, serverId, user.role);
      const interval = setInterval(async () => {
        const stats = await getServerMetrics(serverId);
        socket.emit("stats:update", { serverId, stats });
      }, 3000);
      socket.on("disconnect", () => clearInterval(interval));
    });

    socket.on("disconnect", () => {
      const serverId = socket.data.serverId as string | undefined;
      const handler = socket.data.outputHandler;
      if (serverId && handler) getRuntime(serverId)?.detachOutput(handler);
    });
  });
}
