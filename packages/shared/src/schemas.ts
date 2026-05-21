import { z } from "zod";
import {
  MAX_RAM_MB,
  MIN_RAM_MB,
  RUNTIME_MODES,
  SERVER_TYPES,
  USER_ROLES,
} from "./constants";

/** Self-hosted friendly — accepts admin@localhost, *.local, etc. (Zod .email() rejects those) */
export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+$/, "Invalid email format");

export const registerSchema = z.object({
  email: emailSchema,
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
});

/** `email` field accepts email address or username */
export const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1),
});

export const modpackSourceSchema = z.enum(["modrinth", "curseforge", "upload"]);

export const createServerSchema = z.object({
  name: z.string().min(1).max(64),
  serverType: z.enum(SERVER_TYPES),
  minecraftVersion: z.string().min(1).max(32),
  ramMb: z.number().int().min(MIN_RAM_MB).max(MAX_RAM_MB),
  port: z.number().int().min(1024).max(65535),
  javaVersion: z.string().default("21"),
  runtimeMode: z.enum(RUNTIME_MODES).default("NATIVE"),
  autoRestart: z.boolean().default(true),
  modpackId: z.number().int().optional(),
  modpackFileId: z.number().int().optional(),
  modpackSource: modpackSourceSchema.optional(),
  modpackProjectId: z.string().optional(),
  modpackVersionId: z.string().optional(),
  modpackSlug: z.string().optional(),
  modpackName: z.string().optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  ramMb: z.number().int().min(MIN_RAM_MB).max(MAX_RAM_MB).optional(),
  autoRestart: z.boolean().optional(),
  maxPlayers: z.number().int().min(1).max(1000).optional(),
});

export const consoleCommandSchema = z.object({
  command: z.string().min(1).max(512),
});

export const filePathSchema = z.object({
  path: z.string().max(2048),
});

export const fileWriteSchema = z.object({
  path: z.string().max(2048),
  content: z.string().max(10_000_000),
});

export const playerActionSchema = z.object({
  playerName: z.string().min(1).max(16).regex(/^[a-zA-Z0-9_]{3,16}$/),
});

export const banPlayerSchema = playerActionSchema.extend({
  reason: z.string().max(256).optional(),
});

export const modpackSearchSchema = z.object({
  query: z.string().min(1).max(128),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  source: modpackSourceSchema.default("modrinth"),
});

export const installModpackSchema = z.object({
  source: modpackSourceSchema.default("modrinth"),
  projectId: z.string().min(1),
  versionId: z.string().min(1),
  slug: z.string().optional(),
  name: z.string().min(1).max(64),
  ramMb: z.number().int().min(MIN_RAM_MB).max(MAX_RAM_MB),
  port: z.number().int().min(1024).max(65535),
  runtimeMode: z.enum(RUNTIME_MODES).default("NATIVE"),
});

/** Multipart form fields for POST /api/modpacks/import */
export const importModpackSchema = z.object({
  name: z.string().min(1).max(64),
  ramMb: z.coerce.number().int().min(MIN_RAM_MB).max(MAX_RAM_MB),
  port: z.coerce.number().int().min(1024).max(65535),
  runtimeMode: z.enum(RUNTIME_MODES).default("NATIVE"),
  minecraftVersion: z.string().max(32).optional(),
});

export const backupCreateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type ImportModpackInput = z.infer<typeof importModpackSchema>;
