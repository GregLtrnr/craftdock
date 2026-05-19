import { Router, type IRouter } from "express";
import authRoutes from "./auth.routes";
import serversRoutes from "./servers.routes";
import filesRoutes from "./files.routes";
import playersRoutes from "./players.routes";
import modpacksRoutes from "./modpacks.routes";
import systemRoutes from "./system.routes";

const router: IRouter = Router();

router.use("/auth", authRoutes);
router.use("/servers", serversRoutes);
router.use("/", filesRoutes);
router.use("/", playersRoutes);
router.use("/modpacks", modpacksRoutes);
router.use("/system", systemRoutes);

export default router;
