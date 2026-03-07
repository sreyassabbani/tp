#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
APP_DIR="$ROOT_DIR/apps/teleparty-convex"
ENV_FILE="$APP_DIR/.env.local"

backend_pid=""
web_pid=""

cleanup() {
  local exit_code=$?

  if [[ -n "$web_pid" ]] && kill -0 "$web_pid" 2>/dev/null; then
    kill "$web_pid" 2>/dev/null || true
  fi

  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi

  wait ${web_pid:-} ${backend_pid:-} 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

(
  cd "$APP_DIR"
  exec direnv exec "$ROOT_DIR" bun run convex:dev
) &
backend_pid=$!

for _ in $(seq 1 120); do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid"
    exit $?
  fi

  if [[ -f "$ENV_FILE" ]] && grep -q '^VITE_CONVEX_URL=' "$ENV_FILE"; then
    break
  fi

  sleep 1
done

if [[ ! -f "$ENV_FILE" ]] || ! grep -q '^VITE_CONVEX_URL=' "$ENV_FILE"; then
  echo "Timed out waiting for Convex to write VITE_CONVEX_URL to $ENV_FILE" >&2
  exit 1
fi

(
  cd "$APP_DIR"
  exec direnv exec "$ROOT_DIR" bun run dev
) &
web_pid=$!

wait -n "$backend_pid" "$web_pid"
