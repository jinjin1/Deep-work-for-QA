#!/bin/bash
set -e

# ─── Deep Work for QA Installer ────────────────────────────
# One-line install: curl -fsSL <url>/install.sh | bash

INSTALL_DIR="${DEEP_WORK_DIR:-$HOME/deep-work-for-qa}"
DATA_DIR="$INSTALL_DIR/data"
REPO_URL="https://github.com/jinjin1/Deep-work-for-QA.git"

echo ""
echo "  Deep Work for QA — AI Native QA Workflow Platform"
echo "  ─────────────────────────────────────────────"
echo ""

# ─── 1. Check/install prerequisites ───
check_command() {
  if ! command -v "$1" &> /dev/null; then
    return 1
  fi
  return 0
}

# Homebrew (macOS)
if [[ "$OSTYPE" == "darwin"* ]] && ! check_command brew; then
  echo "[1/5] Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Node.js
if ! check_command node; then
  echo "[1/5] Installing Node.js..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install node
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
else
  echo "[1/5] Node.js found: $(node --version)"
fi

# pnpm
if ! check_command pnpm; then
  echo "[2/5] Installing pnpm..."
  npm install -g pnpm
else
  echo "[2/5] pnpm found: $(pnpm --version)"
fi

# pm2
if ! check_command pm2; then
  echo "[3/5] Installing pm2 (process manager)..."
  npm install -g pm2
else
  echo "[3/5] pm2 found: $(pm2 --version)"
fi

# ─── 2. Download / Update Deep Work ───
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "[4/5] Updating Deep Work for QA..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  echo "[4/5] Downloading Deep Work for QA..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Create data directory
mkdir -p "$DATA_DIR/uploads"

# ─── 3. Configure (must happen before build for NEXT_PUBLIC_* env vars) ───
if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  # Set production data paths
  sed -i.bak "s|DB_PATH=.*|DB_PATH=$DATA_DIR/deep-work.db|" "$INSTALL_DIR/.env"
  sed -i.bak "s|UPLOADS_DIR=.*|UPLOADS_DIR=$DATA_DIR/uploads|" "$INSTALL_DIR/.env"
  rm -f "$INSTALL_DIR/.env.bak"
fi

# Detect LAN IP
LAN_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

# Update API URL with detected IP
sed -i.bak "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${LAN_IP}:3001/v1|" "$INSTALL_DIR/.env"
rm -f "$INSTALL_DIR/.env.bak"

# ─── 4. Build (after .env so NEXT_PUBLIC_API_URL is inlined at build time) ───
echo "[5/5] Installing dependencies and building..."
pnpm install

# Source env vars so NEXT_PUBLIC_API_URL is available during build
set -a
source "$INSTALL_DIR/.env"
set +a

pnpm build

# ─── 5. Start with pm2 ───
cd "$INSTALL_DIR"

pm2 delete deep-work-api 2>/dev/null || true
pm2 delete deep-work-web 2>/dev/null || true

pm2 start "node packages/api/dist/index.js" \
  --name deep-work-api \
  --cwd "$INSTALL_DIR"

pm2 start "npx next start packages/web -p 3000" \
  --name deep-work-web \
  --cwd "$INSTALL_DIR"

pm2 save

# ─── 6. Auto-start on boot ───
pm2 startup 2>/dev/null || true

echo ""
echo "  ─────────────────────────────────────────────"
echo "  Deep Work for QA is running!"
echo ""
echo "  Web Dashboard:  http://${LAN_IP}:3000"
echo "  API Server:     http://${LAN_IP}:3001"
echo "  Data stored in: $DATA_DIR"
echo ""
echo "  Chrome Extension:"
echo "  1. Open chrome://extensions"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked' → select:"
echo "     $INSTALL_DIR/packages/extension/dist"
echo "  4. Open extension settings → enter server IP: $LAN_IP"
echo ""
echo "  Commands:"
echo "    pm2 status          — check server status"
echo "    pm2 logs            — view logs"
echo "    pm2 restart all     — restart servers"
echo "  ─────────────────────────────────────────────"
echo ""
