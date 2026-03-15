# Deep Work for QA

[한글 README](./README.ko.md)

AI-native QA workflow platform. Capture bugs with a Chrome extension, manage them in a web dashboard.

## Features

- **Bug Reporting** — Chrome extension captures screenshots, console logs, network requests, and browser environment in one click
- **Web Dashboard** — View, filter, and manage bug reports with status tracking

## Screenshots

| Bug Report with Annotation | Bug Report Detail | Dashboard |
|:---:|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/c6ed82c5-b9ae-4cfe-aea2-c232531ebce6" width="300"> | <img src="https://github.com/user-attachments/assets/818e8e62-fe1f-44e2-8412-0335a7fe5ad7" width="300"> | <img src="https://github.com/user-attachments/assets/9b172644-d455-4bd2-9d5c-cab576a57296" width="300"> |

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
- Clones the project
- Configures `.env` with your local IP (`NEXT_PUBLIC_API_URL` and `CORS_ORIGIN`, must happen before build)
- Builds all packages
- Starts API + Web servers with pm2 (auto-restart on boot)

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

> **Server admin**: Set up the server using one of the [Quick Start](#quick-start) options (A/B/C).
> Once running, share the **server IP address** (or tunnel URL) and the **extension files** with your team.

### For Team Members: Chrome Extension Install Guide

Team members do not need to run the server. Just install the extension and connect to the shared server.

#### Step 1: Get the Extension Files

Choose one of the following:

**Option 1: Get pre-built files from the server admin (recommended)**

Ask the server admin to zip and share the `packages/extension/dist` folder. Unzip it to any location on your machine. No Node.js or build tools required.

**Option 2: Clone & build yourself**

```bash
git clone https://github.com/jinjin1/Deep-work-for-QA.git
cd Deep-work-for-QA
pnpm install
pnpm --filter @deep-work/extension build
```

> If you don't have pnpm, install it first: `npm install -g pnpm`

#### Step 2: Load the Extension in Chrome

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** → select the `dist` folder (or `packages/extension/dist` if you built it yourself)
4. The extension should now appear in your extensions list

#### Step 3: Connect to the Server

1. Find the Deep Work extension icon in the Chrome toolbar, **right-click** > **Options**
2. Enter the **server IP address** provided by the server admin (e.g. `192.168.1.50`)
3. Save — you're ready to start reporting bugs

### Network Setup

#### Same Wi-Fi Network

Enter the server admin's local IP address in the extension options (e.g. `192.168.1.50`).

> The server admin can find their IP by running `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).

#### Remote / Different Network

Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (free) to expose the local server:

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
