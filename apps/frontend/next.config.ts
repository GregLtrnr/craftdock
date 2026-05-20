import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["xterm", "@xterm/addon-fit", "@xterm/addon-web-links"],
  async rewrites() {
    // Server-side proxy target (Docker: backend:4000, local dev: localhost:4000)
    const api = process.env.API_PROXY_URL ?? "http://127.0.0.1:4000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/socket.io/:path*", destination: `${api}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
