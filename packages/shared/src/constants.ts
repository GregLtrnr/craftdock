export const SERVER_TYPES = [
  "VANILLA",
  "PAPER",
  "PURPUR",
  "FABRIC",
  "FORGE",
  "NEOFORGE",
  "MODPACK",
] as const;

export const RUNTIME_MODES = ["NATIVE", "DOCKER"] as const;

export const USER_ROLES = ["USER", "ADMIN"] as const;

export const SERVER_STATUSES = [
  "INSTALLING",
  "STOPPED",
  "STARTING",
  "RUNNING",
  "STOPPING",
  "CRASHED",
] as const;

export const DEFAULT_JAVA_VERSION = "21";

export const MIN_RAM_MB = 512;
export const MAX_RAM_MB = 65536;

export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".jar",
  ".zip",
  ".json",
  ".properties",
  ".yml",
  ".yaml",
  ".txt",
  ".dat",
  ".mca",
  ".png",
  ".mcmeta",
] as const;
