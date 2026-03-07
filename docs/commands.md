---
tags: [reference, commands, dev]
---

# Dev Commands

<- [[index|Home]]

Use `just` from the repo root. It is the canonical entry point. The recipe implementations live in Nu.

---

## Bootstrap

```bash
cd /Users/sreysus/workflow/tp
just bootstrap
```

Installs Bun dependencies for:
- `apps/teleparty-convex`
- `apps/teleparty-spacetime`
- `apps/teleparty-spacetime/spacetimedb`

---

## Convex Flow

Recommended:

```bash
just convex-dev
```

This runs the backend sync and web client together, and waits for `VITE_CONVEX_URL` before booting Vite.

Manual fallback:

```bash
just convex-backend
just convex-web
```

Manual equivalents:

```bash
cd apps/teleparty-convex
 direnv exec /Users/sreysus/workflow/tp bun run convex:dev
```

```bash
cd apps/teleparty-convex
 direnv exec /Users/sreysus/workflow/tp bun run dev
```

---

## Spacetime Flow

Recommended:

```bash
just spacetime-dev
```

This uses the repo wrapper to:
- start the local server
- publish the module
- regenerate bindings
- keep publish and binding-refresh watchers running
- run the web dev server

Manual fallback:

```bash
cd apps/teleparty-spacetime
 direnv exec /Users/sreysus/workflow/tp bun run spacetime:start
```

```bash
cd apps/teleparty-spacetime
 direnv exec /Users/sreysus/workflow/tp bun run spacetime:publish:local
 direnv exec /Users/sreysus/workflow/tp bun run spacetime:generate
```

```bash
cd apps/teleparty-spacetime
 direnv exec /Users/sreysus/workflow/tp bun run dev
```

The repo used to expose the split flow more prominently, which made Spacetime feel heavier than it needed to. The recommended path is now one command from the repo root.

---

## Build

Build both:

```bash
just build-all
```

Build one app:

```bash
just convex-build
just spacetime-build
```

---

## Useful Verification Commands

Convex typecheck:

```bash
direnv exec /Users/sreysus/workflow/tp ./apps/teleparty-convex/node_modules/.bin/tsc -p apps/teleparty-convex/tsconfig.json --noEmit
```

Convex one-shot backend sync:

```bash
cd apps/teleparty-convex
direnv exec /Users/sreysus/workflow/tp bun run convex:dev:once
```

Spacetime module regeneration:

```bash
cd apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun run spacetime:generate
```

---

## Ports

| Port | Service |
|------|---------|
| `3001` | Convex web app |
| `3002` | Spacetime web app |
| `3010` | Local SpacetimeDB server |

Convex backend endpoint is managed through `.env.local` rather than a fixed human-facing port in this repo.
