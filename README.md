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

### Option A: Install Script (recommended for Mac)

```bash
curl -fsSL https://raw.githubusercontent.com/jinjin1/Deep-work/main/install.sh | bash
```

This installs Node.js, builds the project, and starts servers with auto-restart on boot.

### Option B: Docker Compose

```bash
git clone https://github.com/jinjin1/Deep-work.git
cd Deep-work
cp .env.example .env
# Edit .env to set your server IP
docker compose up -d
```

### Option C: Manual Development Setup

```bash
git clone https://github.com/jinjin1/Deep-work.git
cd Deep-work
pnpm install
pnpm dev          # Starts API (port 3001) + Web (port 3000)
pnpm dev:all      # Also starts extension dev server (port 5173)
```

## Chrome Extension Setup

1. Build the extension: `pnpm --filter @deep-work/extension build`
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select `packages/extension/dist`
5. Right-click the extension icon > **Options** to set your server IP

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `DB_PATH` | `./dev.db` | SQLite database file path |
| `UPLOADS_DIR` | `./data/uploads` | Screenshot file storage |
| `SEED_DEMO_DATA` | `false` | Set `true` to seed demo data |
| `DEEP_WORK_API_KEY` | _(empty)_ | Optional API key for authentication |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/v1` | API URL for the web dashboard |

## Project Structure

```
packages/
  api/          — Backend API (Hono + SQLite)
  web/          — Web dashboard (Next.js)
  extension/    — Chrome extension (Vite + CRXJS)
  shared/       — Shared TypeScript types
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
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm db:reset` | Delete database (re-seeds on restart) |

## License

MIT
