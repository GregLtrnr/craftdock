import { Router, type IRouter } from "express";
import { param } from "../lib/params";
import multer from "multer";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { requireServerAccess } from "../services/permissions.service";
import * as fileService from "../services/file.service";
import { filePathSchema, fileWriteSchema } from "@craftdock/shared";

const router: IRouter = Router({ mergeParams: true });
router.use(authenticate);

const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

router.get("/:serverId/files", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "files");
    const pathQ = (req.query.path as string) ?? ".";
    const files = await fileService.listFiles(param(req.params.serverId), pathQ);
    res.json({ files });
  } catch (e) {
    next(e);
  }
});

router.get("/:serverId/files/content", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "files");
    const { path: filePath } = filePathSchema.parse({ path: req.query.path });
    const content = await fileService.readFile(param(req.params.serverId), filePath);
    res.json({ content });
  } catch (e) {
    next(e);
  }
});

router.put("/:serverId/files/content", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "files");
    const { path: filePath, content } = fileWriteSchema.parse(req.body);
    await fileService.writeFile(param(req.params.serverId), filePath, content);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete("/:serverId/files", async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "files");
    const { path: filePath } = filePathSchema.parse({ path: req.query.path });
    await fileService.deletePath(param(req.params.serverId), filePath);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.post("/:serverId/files/upload", upload.single("file"), async (req: AuthRequest, res, next) => {
  try {
    await requireServerAccess(req.user!.userId, param(req.params.serverId), req.user!.role, "files");
    if (!req.file) return res.status(400).json({ error: "No file" });
    const dir = (req.body.path as string) ?? ".";
    const dest = await fileService.getUploadPath(
      param(req.params.serverId),
      dir,
      req.file.originalname
    );
    const fs = await import("fs/promises");
    await fs.writeFile(dest, req.file.buffer);
    res.status(201).json({ path: dest });
  } catch (e) {
    next(e);
  }
});

export default router;
