# Java 21 via Temurin
FROM eclipse-temurin:21-jre-jammy AS java-runtime

FROM node:20-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates bash wget \
    && rm -rf /var/lib/apt/lists/*
COPY --from=java-runtime /opt/java/openjdk /opt/java-home
ENV JAVA_HOME=/opt/java-home
ENV PATH="${JAVA_HOME}/bin:${PATH}"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @craftdock/shared build
RUN pnpm --filter @craftdock/backend exec prisma generate
RUN pnpm --filter @craftdock/backend build
# Portable production bundle with all runtime deps (fixes "Cannot find module 'express'")
RUN pnpm deploy --filter @craftdock/backend --prod /prod/backend

FROM base AS runner
RUN npm install -g prisma@6.19.3
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /prod/backend/ ./
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma

RUN mkdir -p /var/lib/craftdock/servers /var/lib/craftdock/backups

EXPOSE 4000
# db push only (skip migrate — avoids P3005 on existing DB); --skip-generate avoids npm install in container
CMD ["sh", "-c", "prisma db push --skip-generate || true; exec node dist/index.js"]
