import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

export async function canAccessServer(
  userId: string,
  serverId: string,
  role: string,
  action: "view" | "manage" | "console" | "files" = "view"
): Promise<boolean> {
  if (role === "ADMIN") return true;

  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: { permissions: { where: { userId } } },
  });
  if (!server) return false;
  if (server.ownerId === userId) return true;

  const perm = server.permissions[0];
  if (!perm) return false;

  switch (action) {
    case "manage":
      return perm.canManage;
    case "console":
      return perm.canConsole || perm.canManage;
    case "files":
      return perm.canFiles || perm.canManage;
    default:
      return true;
  }
}

export async function requireServerAccess(
  userId: string,
  serverId: string,
  role: string,
  action: "view" | "manage" | "console" | "files" = "view"
): Promise<void> {
  const allowed = await canAccessServer(userId, serverId, role, action);
  if (!allowed) throw new AppError(403, "Access denied", "FORBIDDEN");
}
