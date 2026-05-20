import { Router, type IRouter } from "express";
import { param } from "../lib/params";
import { createServerSchema, updateServerSchema } from "@craftdock/shared";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { requireServerAccess } from "../services/permissions.service";
import * as serverService from "../services/server.service";
import * as backupService from "../services/backup.service";
import { backupCreateSchema } from "@craftdock/shared";

const router: IRouter = Router();
router.use(authenticate);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const servers = await serverService.listServers(req.user!.userId, req.user!.role);
    res.json({ servers });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const input = createServerSchema.parse(req.body);
    const server = await serverService.createServer(req.user!.userId, input);
    res.status(201).json({ server });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role);
    const server = await serverService.getServer(param(req.params.id));
    res.json({ server });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    const input = updateServerSchema.parse(req.body);
    const server = await serverService.updateServer(param(req.params.id), input);
    res.json({ server });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    await serverService.deleteServer(param(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/start", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    await serverService.startServer(param(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/stop", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    await serverService.stopServer(param(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/restart", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    await serverService.restartServer(param(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/kill", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    await serverService.killServer(param(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/eula", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    await serverService.acceptEula(param(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/:id/logs", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role);
    const logs = await serverService.getServerLogs(param(req.params.id));
    res.json({ logs });
  } catch (e) {
    next(e);
  }
});

router.get("/:id/stats", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role);
    const stats = await serverService.getServerStats(param(req.params.id));
    res.json({ stats });
  } catch (e) {
    next(e);
  }
});

router.get("/:id/backups", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role);
    const backups = await backupService.listBackups(param(req.params.id));
    res.json({ backups });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/backups", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.id), req.user!.role, "manage");
    const { name } = backupCreateSchema.parse(req.body);
    const id = await backupService.createBackup(param(req.params.id), name);
    res.status(201).json({ backupId: id });
  } catch (e) {
    next(e);
  }
});

export default router;
