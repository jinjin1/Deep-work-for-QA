# Deep Work for QA

[한글 README](./README.ko.md)

AI-native QA workflow platform. Capture bugs with a Chrome extension, manage them in a web dashboard.

## Features

- **Bug Reporting** — Chrome extension captures screenshots, console logs, network requests, and browser environment in one click
- **AI Analysis** — Automatic reproduction step generation from captured events
- **Visual Regression Testing** — Compare screenshots against baselines with pixel-level diff analysis
- **Web Dashboard** — View, filter, and manage bug reports with status tracking

## Architecture

```
Chrome Extension (Manifest V3)
  └─ captures screenshots, logs, events
       ↓ HTTP
API Server (Hono + SQLite)
  └─ stores reports, runs AI analysis
       ↓
Web Dashboard (Next.js)
  └─ view & manage bug reports
```

**Tech Stack**: TypeScript, Hono, SQLite (Drizzle ORM), Next.js 15, React 19, Tailwind CSS 4, Vite

## Quick Start

### Option A: Install Script (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/jinjin1/Deep-work-for-QA/main/install.sh | bash
```

This handles everything automatically:
- Installs prerequisites (Node.js, pnpm, pm2)
- Clones and builds the project
- Starts API + Web servers with pm2 (auto-restart on boot)
- Configures `.env` with your local IP

After installation, load the Chrome extension:

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode**
3. Click **Load unpacked** → select the path shown in the install output (e.g. `~/deep-work-for-qa/packages/extension/dist`)
4. Right-click the extension icon > **Options** → enter the server IP shown in the install output

### Option B: Docker Compose

```bash
git clone https://github.com/jinjin1/Deep-work-for-QA.git
cd Deep-work-for-QA
cp .env.example .env
# Edit .env to set your server IP
docker compose up -d
```

### Option C: Manual Development Setup

```bash
git clone https://github.com/jinjin1/Deep-work-for-QA.git
cd Deep-work-for-QA
pnpm install
cp .env.example .env
pnpm dev          # Starts API (port 3001) + Web (port 3000)
```

For the Chrome extension in development:

1. `pnpm --filter @deep-work/extension build`
2. Open `chrome://extensions` → Enable **Developer mode**
3. Click **Load unpacked** → select `packages/extension/dist`
4. Right-click the extension icon > **Options** → set server IP

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `DB_PATH` | `./data/deep-work.db` | SQLite database file path |
| `UPLOADS_DIR` | `./data/uploads` | Screenshot file storage |
| `SEED_DEMO_DATA` | `false` | Set `true` to seed demo data |
| `DEEP_WORK_API_KEY` | _(empty)_ | Optional API key for authentication |
| `CORS_ORIGIN` | _(empty)_ | Allowed CORS origins (comma-separated), empty = `*` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/v1` | API URL for the web dashboard |

> **Note**: The install script (Option A) configures `.env` automatically with your local IP address.

## Team Usage

Multiple team members can report bugs to the same server. Only **one person** needs to run the server — everyone else just installs the Chrome extension.

### Same Wi-Fi Network

Team members just need to:

1. Install the Chrome extension (load `packages/extension/dist`)
2. Set the server IP in extension options to the host machine's IP (e.g. `192.168.1.50`)

### Remote / Different Network

Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (free) to expose your local server:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3001
# Outputs: https://xxx-xxx.trycloudflare.com
```

Team members enter the tunnel URL in the extension options instead of a local IP.

## Project Structure

```
packages/
  api/          — Backend API (Hono + SQLite)
  web/          — Web dashboard (Next.js)
  extension/    — Chrome extension (Vite + CRXJS)
  shared/       — Shared TypeScript types
e2e/            — Playwright E2E tests
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + Web in development mode |
| `pnpm dev:all` | Start API + Web + Extension |
| `pnpm build` | Build all packages |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | Lint all packages |
| `pnpm db:reset` | Delete database (re-seeds on restart) |

## License

MIT
