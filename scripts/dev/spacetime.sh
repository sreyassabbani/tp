#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
APP_DIR="$ROOT_DIR/apps/teleparty-spacetime"
SERVER_ADDR="127.0.0.1:3010"
PID_FILE="$APP_DIR/.spacetime/data/spacetime.pid"

server_pid=""
watch_pid=""
generate_pid=""
web_pid=""
started_server=0

is_server_listening() {
  lsof -iTCP:"${SERVER_ADDR#*:}" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

clear_stale_pid_lock() {
  if [[ ! -f "$PID_FILE" ]]; then
    return
  fi

  local stale_pid
  stale_pid=$(tr -d '[:space:]' < "$PID_FILE")

  if [[ -z "$stale_pid" ]]; then
    rm -f "$PID_FILE"
    return
  fi

  if ! ps -p "$stale_pid" >/dev/null 2>&1; then
    rm -f "$PID_FILE"
    return
  fi

  local command
  command=$(ps -p "$stale_pid" -o command= 2>/dev/null || true)
  if [[ "$command" == *"spacetimedb-standalone"* ]]; then
    kill "$stale_pid" 2>/dev/null || true
    sleep 1
  fi

  rm -f "$PID_FILE"
}

hash_module_sources() {
  (
    cd "$APP_DIR/spacetimedb/src"
    find . -type f | LC_ALL=C sort | while IFS= read -r file; do
      shasum "$file"
    done | shasum | awk '{ print $1 }'
  )
}

cleanup() {
  local exit_code=$?

  for pid in "$web_pid" "$generate_pid" "$watch_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done

  if [[ "$started_server" -eq 1 ]] && [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
  fi

  wait ${web_pid:-} ${generate_pid:-} ${watch_pid:-} ${server_pid:-} 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

if ! is_server_listening; then
  clear_stale_pid_lock

  (
    cd "$APP_DIR"
    exec direnv exec "$ROOT_DIR" bun run spacetime:start
  ) &
  server_pid=$!
  started_server=1

  for _ in $(seq 1 30); do
    if is_server_listening; then
      break
    fi

    if ! kill -0 "$server_pid" 2>/dev/null; then
      wait "$server_pid"
      exit $?
    fi

    sleep 1
  done

  if ! is_server_listening; then
    echo "Timed out waiting for SpacetimeDB to start on $SERVER_ADDR" >&2
    exit 1
  fi
fi

cd "$APP_DIR"
direnv exec "$ROOT_DIR" bun run spacetime:publish:local
direnv exec "$ROOT_DIR" bun run spacetime:generate

(
  cd "$APP_DIR"
  exec direnv exec "$ROOT_DIR" bun run spacetime:dev:server
) &
watch_pid=$!

(
  last_hash=$(hash_module_sources)
  pending=0

  while true; do
    if [[ -n "$watch_pid" ]] && ! kill -0 "$watch_pid" 2>/dev/null; then
      exit 0
    fi

    current_hash=$(hash_module_sources)
    if [[ "$current_hash" != "$last_hash" ]]; then
      last_hash="$current_hash"
      pending=1
    fi

    if [[ "$pending" -eq 1 ]]; then
      if (cd "$APP_DIR" && direnv exec "$ROOT_DIR" bun run spacetime:generate); then
        pending=0
      else
        sleep 1
        continue
      fi
    fi

    sleep 1
  done
) &
generate_pid=$!

(
  cd "$APP_DIR"
  exec direnv exec "$ROOT_DIR" bun run dev
) &
web_pid=$!

wait -n "$watch_pid" "$generate_pid" "$web_pid"
