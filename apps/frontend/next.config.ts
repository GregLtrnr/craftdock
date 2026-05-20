import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // xterm/socket.io are browser-only
  serverExternalPackages: ["xterm", "@xterm/addon-fit", "@xterm/addon-web-links"],
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/socket.io/:path*", destination: `${api}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
