import { Router, type IRouter } from "express";
import { param } from "../lib/params";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { requireServerAccess } from "../services/permissions.service";
import * as playerService from "../services/player.service";
import { playerActionSchema, banPlayerSchema } from "@craftdock/shared";

const router: IRouter = Router({ mergeParams: true });
router.use(authenticate);

router.get("/:serverId/players", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role);
    const [online, lists] = await Promise.all([
      playerService.getOnlinePlayers(param(req.params.serverId)),
      playerService.getPlayerLists(param(req.params.serverId)),
    ]);
    res.json({ online, ...lists });
  } catch (e) {
    next(e);
  }
});

router.post("/:serverId/players/op", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "manage");
    const { playerName } = playerActionSchema.parse(req.body);
    await playerService.opPlayer(param(req.params.serverId), playerName, true);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:serverId/players/ban", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "manage");
    const { playerName, reason } = banPlayerSchema.parse(req.body);
    await playerService.banPlayer(param(req.params.serverId), playerName, reason);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:serverId/players/kick", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "manage");
    const { playerName } = playerActionSchema.parse(req.body);
    const reason = req.body.reason as string | undefined;
    await playerService.kickPlayer(param(req.params.serverId), playerName, reason);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
