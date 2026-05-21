import { Router, type IRouter } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { MAX_MODPACK_UPLOAD_BYTES } from "@craftdock/shared";
import { param } from "../lib/params";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { modpackSearchSchema, installModpackSchema, importModpackSchema } from "@craftdock/shared";
import {
  saveUploadedModpackArchive,
  saveModpackImportOptions,
} from "../services/import-modpack.service";
import {
  searchModpacks,
  getModpackVersions,
  getModpackSourcesStatus,
  parseModpackSource,
} from "../services/modpack.service";
import * as serverService from "../services/server.service";
import { scheduleServerInstall } from "../services/server.service";

const router: IRouter = Router();
router.use(authenticate);

const upload = multer({
  limits: { fileSize: MAX_MODPACK_UPLOAD_BYTES },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `craftdock-import-${Date.now()}-${safe}`);
    },
  }),
});

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

router.post("/import", upload.single("file"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No modpack file uploaded (.zip or .mrpack)" });
    }
    const input = importModpackSchema.parse(req.body);

    const server = await serverService.createServer(
      req.user!.userId,
      {
        name: input.name,
        serverType: "MODPACK",
        minecraftVersion: input.minecraftVersion?.trim() || "1.20.1",
        ramMb: input.ramMb,
        port: input.port,
        javaVersion: "21",
        runtimeMode: input.runtimeMode,
        autoRestart: true,
        modpackSource: "upload",
        modpackProjectId: "upload",
        modpackVersionId: req.file.originalname,
        modpackName: input.name,
      },
      { deferInstall: true }
    );

    await saveUploadedModpackArchive(
      server.dataPath,
      { tempPath: path.resolve(req.file.path) },
      req.file.originalname
    );
    await saveModpackImportOptions(server.dataPath, {
      loader: input.loader,
      loaderVersion: input.loaderVersion,
      minecraftVersion: input.minecraftVersion,
    });
    scheduleServerInstall(server.id);

    res.status(201).json({ server });
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
