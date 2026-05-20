# CraftDock

Self-hosted Minecraft hosting panel for Ubuntu VPS/dedicated servers. Manage Vanilla, Paper, Purpur, Fabric, Forge, NeoForge, and CurseForge modpacks from a modern web dashboard.

## Features

- **Authentication** — Register/login, JWT + session cookies, Argon2 password hashing, RBAC (USER/ADMIN)
- **Server management** — Create, start, stop, restart, kill, auto-restart on crash
- **Server types** — Vanilla, Paper, Purpur, Fabric, Forge, NeoForge + CurseForge modpacks
- **Runtime modes** — Native Linux processes or Docker container isolation
- **Live console** — WebSocket streaming with xterm.js, command input, scrollback
- **File manager** — Browse, upload, edit, delete with path traversal protection
- **Properties editor** — `server.properties` and JSON player files
- **Player management** — OP, whitelist, ban, kick via console or config files
- **Monitoring** — CPU/RAM/disk via `systeminformation`, realtime WebSocket stats
- **Backups** — Manual backups, scheduled retention, restore
- **API** — REST with Zod validation, OpenAPI docs at `/api/docs`
- **Deployment** — Docker Compose, Nginx reverse proxy, Ubuntu `setup.sh`

## Architecture

```
craftdock/
├── apps/
│   ├── backend/     # Express + Socket.IO + Prisma
│   └── frontend/    # Next.js App Router + Tailwind + shadcn-style UI
├── packages/
│   ├── shared/      # Zod schemas, types, constants
│   └── ui/          # Shared UI primitives (optional)
├── deploy/nginx/    # Production reverse proxy
├── docker-compose.yml
└── setup.sh         # Ubuntu installer
```

### Backend modules

| Module | Purpose |
|--------|---------|
| `adapters/` | Modular server jar download & install (Vanilla, Paper, etc.) |
| `runtime/` | `NativeRuntime` and `DockerRuntime` implementing common interface |
| `services/curseforge.service.ts` | CurseForge API abstraction |
| `services/file.service.ts` | Secure filesystem access |
| `socket/` | Authenticated console & stats WebSockets |

## Quick start (Docker)

```bash
cp .env.example .env
# Edit JWT_SECRET, CURSEFORGE_API_KEY, admin password

docker compose up -d
```

- Panel: http://localhost:3000
- API: http://localhost:4000
- API docs: http://localhost:4000/api/docs

First registered user becomes **ADMIN**, or use seeded admin from `.env`.

## Development

Requirements: Node 20+, pnpm 9+, PostgreSQL 16+, Java 21 (for native servers)

```bash
pnpm install
cp .env.example .env

# Start Postgres (or use docker compose up postgres -d)
pnpm db:push

pnpm dev
```

## Production (Ubuntu VPS)

```bash
sudo ./setup.sh
# Edit .env with production secrets
docker compose --profile production up -d
```

If `db:push` fails with `Environment variable not found: DATABASE_URL`:

```bash
cp .env.example .env   # if you have not already
bash scripts/sync-env.sh
docker compose up -d postgres   # Prisma needs Postgres running on localhost:5432
pnpm db:push                    # avoid sudo — use your normal user
```

If `docker compose build` fails installing Java, pull the latest `apps/backend/Dockerfile` (bundles Eclipse Temurin 21) and rebuild:

```bash
docker compose build --no-cache backend
docker compose up -d
```

If `pnpm install` fails with `gyp ERR! not found: make`, install build tools and retry:

```bash
sudo apt-get install -y build-essential python3
pnpm install
pnpm db:push
```

Nginx terminates HTTP and proxies `/api` and `/socket.io` to the backend.

### Connecting from another PC on your LAN

Modpack servers run in **Native** mode inside the `backend` container. Their port is **not** 25565 by default (modpack install picks a random port in 25566–25665). Use the port shown on the server page.

1. Open the panel at `http://<ubuntu-lan-ip>:3000` (e.g. `http://192.168.1.170:3000`).
2. On the server page, use **Multiplayer → Add server** with address `<ubuntu-lan-ip>:<port>` (same port as in the panel).
3. **Ping (ICMP) does not work** for Minecraft — use the game port, not ping.
4. After changing `docker-compose.yml` port ranges, recreate the backend:

   ```bash
   docker compose up -d backend
   ```

5. Open the port on Ubuntu if UFW is enabled:

   ```bash
   sudo ufw allow 25565:25665/tcp
   ```

6. Test from your laptop: `nc -zv 192.168.1.170 25566` (replace IP and port).

### Environment variables

See `apps/backend/.env.example` for full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (32+ chars) |
| `CURSEFORGE_API_KEY` | [CurseForge API key](https://console.curseforge.com/) for modpacks |
| `DATA_DIR` | Server files root (`/var/lib/craftdock/servers`) |
| `DOCKER_ENABLED` | Enable Docker runtime mode |

## Security

- No raw shell command execution — spawn uses argument arrays only
- Path traversal prevention on all file operations
- CSRF tokens on mutating API requests
- Rate limiting, Helmet headers, CORS lockdown
- WebSocket authentication required for console access
- Upload extension allowlist

## Roadmap (architecture in place)

- Scheduled tasks / auto-updates
- Plugin installer
- Multi-node support (`Node` model)
- SFTP/FTP, public API keys, webhooks

## License

MIT
