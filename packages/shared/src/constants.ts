export const SERVER_TYPES = [
  "VANILLA",
  "PAPER",
  "PURPUR",
  "FABRIC",
  "FORGE",
  "NEOFORGE",
  "MODPACK",
] as const;

/** Loader choices for uploaded modpack import (auto = read manifest / instance json). */
export const MODPACK_IMPORT_LOADERS = [
  "auto",
  "FABRIC",
  "NEOFORGE",
  "FORGE",
  "VANILLA",
  "PAPER",
  "PURPUR",
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

/** Max modpack zip/.mrpack upload size (5 GiB) */
export const MAX_MODPACK_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

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
