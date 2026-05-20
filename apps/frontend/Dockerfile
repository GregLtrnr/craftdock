FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Proxy /api from Next → backend container (baked into standalone rewrites at build time)
ARG API_PROXY_URL=http://backend:4000
ENV API_PROXY_URL=$API_PROXY_URL
RUN mkdir -p apps/frontend/public
RUN pnpm --filter @craftdock/shared build
RUN pnpm --filter @craftdock/frontend build

FROM base AS runner
RUN apk add --no-cache wget
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["node", "server.js"]
