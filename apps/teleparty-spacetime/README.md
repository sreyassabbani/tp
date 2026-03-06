# Teleparty SpacetimeDB Version

TanStack Start + shadcn UI + SpacetimeDB v2.0 TypeScript module.

## Features

- room creation from arbitrary watch URL
- public/private rooms (private rooms use access code)
- live cursor sync through participant table updates
- soundboard events with participant-capacity gating
- room-owner soundboard policy overrides

## Local run

Recommended:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun install
direnv exec /Users/sreysus/workflow/tp bun --cwd spacetimedb install
direnv exec /Users/sreysus/workflow/tp bun run spacetime:dev
```

`spacetime:dev` uses a repo wrapper around the Spacetime CLI to:

- start the local SpacetimeDB server
- publish the module
- generate TypeScript bindings
- keep the module watcher running
- refresh bindings when module source changes
- run the Vite web app

Manual fallback:

1) Start local SpacetimeDB server:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun install
direnv exec /Users/sreysus/workflow/tp bun --cwd spacetimedb install
direnv exec /Users/sreysus/workflow/tp bun run spacetime:start
```

2) Publish module and generate typed bindings:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun run spacetime:publish:local
direnv exec /Users/sreysus/workflow/tp bun run spacetime:generate
```

3) Start web app:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun run dev
```

App URL: `http://localhost:3002`
SpacetimeDB URL: `ws://127.0.0.1:3010`

If publish auth gets stuck, delete `.spacetime/data` and restart `bun run spacetime:start`.

## Build

```bash
direnv exec /Users/sreysus/workflow/tp bun run build
```
