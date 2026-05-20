/**
 * API client — always uses relative URLs in the browser (/api/...).
 * That way login works from any device on your LAN (e.g. http://192.168.1.170:3000),
 * not only on the server machine. Next.js rewrites /api → backend (see API_PROXY_URL).
 */
function apiBase(): string {
  if (typeof window !== "undefined") return "";
  return process.env.API_PROXY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
}

let csrfToken: string | null = null;

export async function fetchCsrf(): Promise<string> {
  const res = await fetch(`${apiBase()}/api/auth/csrf`, { credentials: "include" });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!csrfToken && options.method && options.method !== "GET") {
    await fetchCsrf();
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (csrfToken && options.method && options.method !== "GET") {
    (headers as Record<string, string>)["x-csrf-token"] = csrfToken;
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }

  if (res.status === 204) return {} as T;
  return res.json();
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
