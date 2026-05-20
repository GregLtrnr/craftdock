import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
import type { RegisterInput, LoginInput } from "@craftdock/shared";

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as AuthPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token", "INVALID_TOKEN");
  }
}

function hashSessionToken(token: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(token).digest("hex");
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) throw new AppError(409, "Email or username already exists", "CONFLICT");

  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "ADMIN" : "USER";

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash: await hashPassword(input.password),
      role,
    },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });

  const { token, session } = await createSession(user.id);
  return { user, token, expiresAt: session.expiresAt };
}

export async function login(input: LoginInput, meta?: { ip?: string; ua?: string }) {
  const identifier = input.email.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const { token, session } = await createSession(user.id, meta);
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    token,
    expiresAt: session.expiresAt,
  };
}

async function createSession(userId: string, meta?: { ip?: string; ua?: string }) {
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: meta?.ip,
      userAgent: meta?.ua,
    },
  });

  return { token, session };
}

export async function validateSession(token: string): Promise<AuthPayload | null> {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function logout(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function seedAdminIfNeeded(): Promise<void> {
  const count = await prisma.user.count();
  if (count === 0) {
    await prisma.user.create({
      data: {
        email: env.adminEmail,
        username: env.adminUsername,
        passwordHash: await hashPassword(env.adminPassword),
        role: "ADMIN",
      },
    });
    console.log(`[CraftDock] Seeded admin user: ${env.adminUsername} <${env.adminEmail}>`);
    return;
  }

  // Keep admin in sync when .env email/password changes
  const admin = await prisma.user.findFirst({
    where: { OR: [{ username: env.adminUsername }, { role: "ADMIN" }] },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) return;

  const emailChanged = admin.email !== env.adminEmail;
  const passwordValid = await verifyPassword(admin.passwordHash, env.adminPassword).catch(
    () => false
  );

  if (emailChanged || !passwordValid) {
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: env.adminEmail,
        ...(passwordValid ? {} : { passwordHash: await hashPassword(env.adminPassword) }),
      },
    });
    console.log(`[CraftDock] Updated admin account to ${env.adminUsername} <${env.adminEmail}>`);
  }
}
