# Teleparty Convex Version

TanStack Start + shadcn UI + Convex backend.

## Features

- room creation from arbitrary watch URL
- public/private rooms (private rooms use access code)
- live cursor presence
- soundboard events with participant-capacity gating
- room-owner soundboard policy overrides
- Convex components:
  - `@convex-dev/presence`
  - `@convex-dev/rate-limiter`
  - `@convex-dev/workflow`

## Run

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-convex
direnv exec /Users/sreysus/workflow/tp pnpm convex:dev
```

Then in another terminal:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-convex
direnv exec /Users/sreysus/workflow/tp pnpm dev
```

App URL: `http://localhost:3001`

## Build

```bash
direnv exec /Users/sreysus/workflow/tp pnpm build
```
