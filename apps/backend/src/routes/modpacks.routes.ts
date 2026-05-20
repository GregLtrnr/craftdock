import { Router, type IRouter } from "express";
import { param } from "../lib/params";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { modpackSearchSchema, installModpackSchema } from "@craftdock/shared";
import {
  searchModpacks,
  getModpackVersions,
  getModpackSourcesStatus,
  parseModpackSource,
} from "../services/modpack.service";
import * as serverService from "../services/server.service";

const router: IRouter = Router();
router.use(authenticate);

router.get("/status", async (_req, res, next) => {
  try {
    res.json(await getModpackSourcesStatus());
  } catch (e) {
    next(e);
  }
});

router.get("/search", async (req: AuthRequest, res, next) => {
  try {
    const { query, page, pageSize, source } = modpackSearchSchema.parse(req.query);
    const results = await searchModpacks(source, query, page, pageSize);
    res.json({ results, source });
  } catch (e) {
    next(e);
  }
});

router.get("/:projectId/versions", async (req: AuthRequest, res, next) => {
  try {
    const source = parseModpackSource(req.query.source);
    const projectId = param(req.params.projectId);
    const slug = typeof req.query.slug === "string" ? req.query.slug : undefined;
    const files = await getModpackVersions(source, projectId, slug);
    res.json({ files, source });
  } catch (e) {
    next(e);
  }
});

/** @deprecated use GET /:projectId/versions */
router.get("/:modId/files", async (req: AuthRequest, res, next) => {
  try {
    const source = parseModpackSource(req.query.source ?? "curseforge");
    const modId = param(req.params.modId);
    const slug = typeof req.query.slug === "string" ? req.query.slug : undefined;
    const files = await getModpackVersions(source, modId, slug);
    res.json({ files, source });
  } catch (e) {
    next(e);
  }
});

router.post("/install", async (req: AuthRequest, res, next) => {
  try {
    const input = installModpackSchema.parse(req.body);
    const cfIds =
      input.source === "curseforge"
        ? { modpackId: parseInt(input.projectId, 10), modpackFileId: parseInt(input.versionId, 10) }
        : {};

    const server = await serverService.createServer(req.user!.userId, {
      name: input.name,
      serverType: "MODPACK",
      minecraftVersion: "1.20.1",
      ramMb: input.ramMb,
      port: input.port,
      javaVersion: "21",
      runtimeMode: input.runtimeMode,
      autoRestart: true,
      modpackSource: input.source,
      modpackProjectId: input.projectId,
      modpackVersionId: input.versionId,
      modpackSlug: input.slug,
      modpackName: input.name,
      modpackId: cfIds.modpackId,
      modpackFileId: cfIds.modpackFileId,
    });
    res.status(201).json({ server });
  } catch (e) {
    next(e);
  }
});

export default router;
