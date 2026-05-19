#!/usr/bin/env bash
set -euo pipefail

# CraftDock Ubuntu VPS installation script
# Run as root or with sudo on Ubuntu 22.04+

echo "==> CraftDock Setup"

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo: sudo ./setup.sh"
  exit 1
fi

apt-get update
# build-essential: required for native npm modules (e.g. argon2) when not using Docker-only deploy
apt-get install -y curl git ca-certificates gnupg lsb-release openjdk-21-jre-headless build-essential python3

# Docker
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# Node.js 20 (for local dev without Docker)
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  corepack enable
fi

# Data directories
mkdir -p /var/lib/craftdock/servers /var/lib/craftdock/backups
chown -R "${SUDO_USER:-root}:${SUDO_USER:-root}" /var/lib/craftdock 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Created .env — edit secrets before production!"
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env 2>/dev/null || true
fi

# Install dependencies and build
if ! command -v pnpm &>/dev/null; then
  corepack enable 2>/dev/null || true
  npm install -g pnpm@9
fi

pnpm install
pnpm db:push

echo ""
echo "==> Setup complete!"
echo ""
echo "Start with Docker:"
echo "  docker compose up -d"
echo ""
echo "Or development:"
echo "  pnpm dev"
echo ""
echo "Panel: http://localhost:3000"
echo "API:   http://localhost:4000"
echo "Default admin (first seed): see .env ADMIN_* variables"
