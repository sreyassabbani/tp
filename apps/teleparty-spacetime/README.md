# Teleparty SpacetimeDB Version

TanStack Start + shadcn UI + SpacetimeDB v2.0 TypeScript module.

## Features

- room creation from arbitrary watch URL
- public/private rooms (private rooms use access code)
- live cursor sync through participant table updates
- soundboard events with participant-capacity gating
- room-owner soundboard policy overrides

## Local run

1) Start local SpacetimeDB server:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp pnpm spacetime:start
```

2) Publish module and generate typed bindings:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp pnpm spacetime:publish:local
direnv exec /Users/sreysus/workflow/tp pnpm spacetime:generate
```

3) Start web app:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp pnpm dev
```

App URL: `http://localhost:3002`
SpacetimeDB URL: `ws://127.0.0.1:3010`

If publish auth gets stuck, delete `.spacetime/data` and restart `pnpm spacetime:start`.

## Build

```bash
direnv exec /Users/sreysus/workflow/tp pnpm build
```
