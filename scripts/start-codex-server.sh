#!/usr/bin/env bash
# Quick launcher for the Copy AI ID → Codex local server.
# Usage: scripts/start-codex-server.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "start-codex-server: node is not installed or not on PATH." >&2
  exit 1
fi

if [ -z "${CODEX_BIN:-}" ] && ! command -v codex >/dev/null 2>&1; then
  echo "warning: codex CLI not found on PATH. Install it or set CODEX_BIN." >&2
fi

exec node scripts/codex-server.mjs "$@"
