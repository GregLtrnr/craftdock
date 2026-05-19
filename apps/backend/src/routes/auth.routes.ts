import { Router, type IRouter } from "express";
import { registerSchema, loginSchema } from "@craftdock/shared";
import * as authService from "../services/auth.service";
import { issueCsrfToken } from "../middleware/csrf";
import { authenticate, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/csrf", issueCsrfToken);

router.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.cookie("craftdock_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, {
      ip: req.ip,
      ua: req.headers["user-agent"],
    });
    res.cookie("craftdock_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/logout", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const token = req.cookies?.craftdock_token;
    if (token) await authService.logout(token);
    res.clearCookie("craftdock_token");
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
