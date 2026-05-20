import type { Socket } from "socket.io";

/** JWT from Socket.IO auth, Authorization header, or httpOnly craftdock_token cookie. */
export function getSocketAuthToken(socket: Socket): string | undefined {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === "string" && fromAuth.length > 0) return fromAuth;

  const authHeader = socket.handshake.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "craftdock_token" && rest.length > 0) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}
