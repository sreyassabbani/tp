---
tags: [reference, commands, dev]
---

# Dev Commands

<- [[index|Home]]

Use `just` from the repo root. It is the canonical entry point.

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

Run in two terminals:

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

Run in three terminals:

```bash
just spacetime-db
just spacetime-sync
just spacetime-web
```

Manual equivalents:

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
