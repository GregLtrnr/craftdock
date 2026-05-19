import { Router, type IRouter } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { getSystemMetrics } from "../services/monitoring.service";
import type { AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "craftdock-api", version: "0.1.0" });
});

router.get("/metrics", authenticate, requireAdmin, async (_req: AuthRequest, res, next) => {
  try {
    const metrics = await getSystemMetrics();
    res.json({ metrics });
  } catch (e) {
    next(e);
  }
});

export default router;
