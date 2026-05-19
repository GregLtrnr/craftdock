import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith("/api/auth")) return next();

  const headerToken = req.headers["x-csrf-token"] as string | undefined;
  const cookieToken = req.cookies?.craftdock_csrf as string | undefined;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: "CSRF validation failed", code: "CSRF_INVALID" });
  }
  next();
}

export function issueCsrfToken(_req: Request, res: Response): void {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie("craftdock_csrf", token, {
    httpOnly: false,
    secure: env.nodeEnv === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ csrfToken: token });
}
