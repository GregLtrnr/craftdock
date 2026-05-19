export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "CraftDock API",
    version: "0.1.0",
    description: "Self-hosted Minecraft hosting panel REST API",
  },
  servers: [{ url: "/api" }],
  paths: {
    "/auth/register": {
      post: { summary: "Register user", tags: ["Auth"] },
    },
    "/auth/login": {
      post: { summary: "Login", tags: ["Auth"] },
    },
    "/servers": {
      get: { summary: "List servers", tags: ["Servers"] },
      post: { summary: "Create server", tags: ["Servers"] },
    },
    "/servers/{id}/start": {
      post: { summary: "Start server", tags: ["Servers"] },
    },
    "/modpacks/search": {
      get: { summary: "Search CurseForge modpacks", tags: ["Modpacks"] },
    },
    "/system/health": {
      get: { summary: "Health check", tags: ["System"] },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "craftdock_token" },
    },
  },
};
