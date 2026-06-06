#!/usr/bin/env bash
# Cron entrypoint. Sources .env (SMTP creds etc.) and runs one alert.
# cron has a minimal PATH, so we set a sane one and resolve node explicitly.
set -euo pipefail
cd "$(dirname "$0")"

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

# Load .env (KEY=value, values may be quoted)
set -a
[ -f .env ] && . ./.env
set +a

NODE="$(command -v node || true)"
[ -z "$NODE" ] && { echo "node not found on PATH" >&2; exit 1; }

exec "$NODE" src/index.js "$@"
