#!/bin/bash
export PATH="$HOME/.local/share/asdf/installs/nodejs/22.12.0/bin:$PATH"
cd "$(dirname "$0")/.."
exec pnpm --filter @deep-work/api dev
