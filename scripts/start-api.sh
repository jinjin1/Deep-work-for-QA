#!/bin/bash

cd "$(dirname "$0")/.."
exec pnpm --filter @deep-work/api dev
