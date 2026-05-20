#!/usr/bin/env bash
# Run on the CraftDock server (SSH) to see why port 4000 is down
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== docker compose ps ==="
docker compose ps -a

echo ""
echo "=== backend logs (last 60 lines) ==="
docker compose logs backend --tail 60 2>/dev/null || echo "No backend container"

echo ""
echo "=== postgres logs (last 20 lines) ==="
docker compose logs postgres --tail 20 2>/dev/null || true

echo ""
echo "=== port 4000 on host ==="
ss -tlnp 2>/dev/null | grep ':4000' || netstat -tlnp 2>/dev/null | grep ':4000' || echo "Nothing listening on 4000"

echo ""
echo "=== curl localhost:4000 (on server) ==="
curl -sS -m 3 http://127.0.0.1:4000/api/system/health || echo "FAILED — backend not responding locally"

echo ""
echo "=== .env present? ==="
test -f .env && echo "yes" || echo "MISSING — run: cp .env.example .env"
