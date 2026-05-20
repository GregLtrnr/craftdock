#!/usr/bin/env bash
# Diagnose Minecraft port reachability on the CraftDock host.
# Usage: bash scripts/check-minecraft-port.sh [PORT]
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${1:-}"
if [[ -z "$PORT" ]]; then
  echo "Usage: $0 <minecraft-port>"
  echo "Or list server ports from DB:"
  docker compose exec postgres psql -U craftdock -d craftdock -c \
    'SELECT name, port, status FROM "Server";'
  exit 1
fi

echo "=== Server port $PORT ==="
echo ""
echo "--- Inside backend container ---"
docker compose exec -T backend sh -lc "ss -tln 2>/dev/null | grep ':$PORT ' || netstat -tln 2>/dev/null | grep ':$PORT ' || echo 'NOT listening inside backend'"

echo ""
echo "--- On Ubuntu host (Docker publish) ---"
ss -tlnp 2>/dev/null | grep ":$PORT " || netstat -tlnp 2>/dev/null | grep ":$PORT " || echo "NOT listening on host — recreate backend: docker compose up -d --force-recreate backend"

echo ""
echo "--- TCP probe localhost ---"
nc -zv 127.0.0.1 "$PORT" 2>&1 || echo "FAILED on 127.0.0.1"

echo ""
echo "--- server.properties (if path known) ---"
docker compose exec postgres psql -U craftdock -d craftdock -t -A -c \
  "SELECT \"dataPath\" FROM \"Server\" WHERE port=$PORT LIMIT 1;" | while read -r dp; do
  [[ -z "$dp" ]] && continue
  echo "dataPath: $dp"
  docker compose exec -T backend sh -lc "grep -E '^(server-port|server-ip)=' '$dp/server.properties' 2>/dev/null || echo 'no server.properties'"
  docker compose exec -T backend sh -lc "ps aux | grep -E '[j]ava.*server.jar' || echo 'no java server process'"
done

echo ""
echo "--- UFW ---"
sudo ufw status 2>/dev/null | grep -E "$PORT|25565:25665" || echo "ufw not active or rule missing"
