import { Request, Response, NextFunction } from "express";
import { verifyToken, validateSession } from "../services/auth.service";
import { AppError } from "../lib/errors";

export interface AuthRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.craftdock_token as string | undefined;
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

    if (!token) throw new AppError(401, "Authentication required", "UNAUTHORIZED");

    let payload = await validateSession(token);
    if (!payload) {
      payload = verifyToken(token);
    }

    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return next(new AppError(403, "Admin access required", "FORBIDDEN"));
  }
  next();
}
