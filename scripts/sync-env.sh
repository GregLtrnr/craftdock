#!/usr/bin/env bash
# Prisma loads .env from apps/backend/ — keep it in sync with the repo root .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="$ROOT/apps/backend/.env"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Error: $ROOT/.env not found."
  echo "Create it with: cp .env.example .env"
  exit 1
fi

ln -sf "$ROOT/.env" "$BACKEND_ENV"
echo "Synced .env -> apps/backend/.env"
