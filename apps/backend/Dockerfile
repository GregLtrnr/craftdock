# CraftDock backend — production image (Prisma 6, pnpm monorepo)
FROM eclipse-temurin:21-jre-jammy AS java-runtime

FROM node:20-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates bash wget unzip python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY --from=java-runtime /opt/java/openjdk /opt/java-home
ENV JAVA_HOME=/opt/java-home
ENV PATH="${JAVA_HOME}/bin:${PATH}"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# --- Install dependencies ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @craftdock/shared build \
    && pnpm --filter @craftdock/backend exec prisma generate \
    && pnpm --filter @craftdock/backend build \
    && pnpm deploy --filter @craftdock/backend --prod /prod/backend

# --- Production ---
FROM base AS runner
RUN npm install -g prisma@6.19.3
ENV NODE_ENV=production
WORKDIR /app

# Runtime bundle: prod deps + compiled JS + Prisma schema
COPY --from=builder /prod/backend/ ./
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma

# Generate Prisma Client into THIS image's node_modules (required after pnpm deploy)
RUN prisma generate

RUN mkdir -p /var/lib/craftdock/servers /var/lib/craftdock/backups

EXPOSE 4000

# Sync DB schema at start (no migrate — avoids P3005); client already generated above
CMD ["sh", "-c", "prisma db push --skip-generate && exec node dist/index.js"]
