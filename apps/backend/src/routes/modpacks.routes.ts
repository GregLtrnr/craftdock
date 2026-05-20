import { Router, type IRouter } from "express";
import { param } from "../lib/params";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { modpackSearchSchema, installModpackSchema } from "@craftdock/shared";
import { curseForgeService } from "../services/curseforge.service";
import * as serverService from "../services/server.service";

const router: IRouter = Router();
router.use(authenticate);

router.get("/search", async (req: AuthRequest, res, next) => {
  try {
    const { query, page, pageSize } = modpackSearchSchema.parse(req.query);
    const results = await curseForgeService.searchModpacks(query, page, pageSize);
    res.json({ results });
  } catch (e) {
    next(e);
  }
});

router.get("/:modId/files", async (req: AuthRequest, res, next) => {
  try {
    const modId = parseInt(param(req.params.modId), 10);
    const slug = typeof req.query.slug === "string" ? req.query.slug : undefined;
    const files = await curseForgeService.getModpackFiles(modId, slug);
    res.json({ files });
  } catch (e) {
    next(e);
  }
});

router.post("/install", async (req: AuthRequest, res, next) => {
  try {
    const input = installModpackSchema.parse(req.body);
    const server = await serverService.createServer(req.user!.userId, {
      name: input.name,
      serverType: "MODPACK",
      minecraftVersion: "1.20.1",
      ramMb: input.ramMb,
      port: input.port,
      javaVersion: "21",
      runtimeMode: input.runtimeMode,
      autoRestart: true,
      modpackId: input.modpackId,
      modpackFileId: input.fileId,
    });
    res.status(201).json({ server });
  } catch (e) {
    next(e);
  }
});

export default router;
