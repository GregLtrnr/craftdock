/**
 * Public API URL — frontend :3000, API :4000 on the same host.
 */
/** Socket.IO URL — connect directly to backend (:4000). */
export function getSocketBase(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export function getApiBase(): string {
  if (typeof window === "undefined") {
    return process.env.API_PROXY_URL ?? "http://127.0.0.1:4000";
  }
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

let csrfToken: string | null = null;

export async function fetchCsrf(): Promise<string> {
  const res = await fetch(`${getApiBase()}/api/auth/csrf`, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CSRF failed (${res.status}): ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const needsCsrf = method !== "GET" && method !== "HEAD";
  if (needsCsrf && !csrfToken) {
    await fetchCsrf();
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (needsCsrf && csrfToken) {
    (headers as Record<string, string>)["x-csrf-token"] = csrfToken;
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg = err.error ?? res.statusText;
    throw new Error(err.code ? `${msg} (${err.code})` : msg);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return {} as T;
  }
  return res.json();
}

/** Multipart upload (e.g. modpack zip) — do not set Content-Type so the browser sets boundary. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  if (!csrfToken) {
    await fetchCsrf();
  }
  const headers: HeadersInit = {};
  if (csrfToken) {
    (headers as Record<string, string>)["x-csrf-token"] = csrfToken;
  }
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg = err.error ?? res.statusText;
    throw new Error(err.code ? `${msg} (${err.code})` : msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

export interface Server {
  id: string;
  name: string;
  uuid: string;
  serverType: string;
  minecraftVersion: string;
  ramMb: number;
  port: number;
  status: string;
  runtimeMode: string;
  eulaAccepted: boolean;
  maxPlayers: number;
  createdAt: string;
  startedAt?: string;
  owner?: { username: string };
  dataPath?: string;
}

export interface ServerStats {
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  onlinePlayers: number;
  maxPlayers: number;
  uptimeSeconds: number;
  processState: string;
}
