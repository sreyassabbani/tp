# Teleparty Clone Lab (Convex + SpacetimeDB)

This repo contains two side-by-side implementations of the same Teleparty-style product:

- `apps/teleparty-convex` : TanStack Start + shadcn + Convex (with Presence, Rate Limiter, Workflow components)
- `apps/teleparty-spacetime` : TanStack Start + shadcn + SpacetimeDB v2.0 TypeScript module

Both variants support:

- room creation from any URL (URL uniqueness is not required)
- private/public rooms (private rooms require access code)
- shared live cursor overlays
- soundboard playback with room-size gating
- owner-overridable soundboard policy

## Nix + direnv workflow

```bash
direnv allow
```

The dev shell is pinned to DeterminateSystems weekly nixpkgs and includes:

- Node.js / bun
- Rust toolchain
- SpacetimeDB CLI `v2.0.3`

## Quick start

### Convex version

Terminal 1:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-convex
direnv exec /Users/sreysus/workflow/tp bun install
direnv exec /Users/sreysus/workflow/tp bun run convex:dev
```

Terminal 2:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-convex
direnv exec /Users/sreysus/workflow/tp bun run dev
```

App URL: `http://localhost:3001`

### SpacetimeDB version

Terminal 1 (local database server):

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun install
direnv exec /Users/sreysus/workflow/tp bun --cwd spacetimedb install
direnv exec /Users/sreysus/workflow/tp bun run spacetime:start
```

Terminal 2 (publish module + generate bindings):

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun run spacetime:publish:local
direnv exec /Users/sreysus/workflow/tp bun run spacetime:generate
```

Terminal 3 (web app):

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun run dev
```

App URL: `http://localhost:3002`
SpacetimeDB URL: `ws://127.0.0.1:3010`

If local publish auth gets into a bad state, remove `apps/teleparty-spacetime/.spacetime/data` and restart.

## Design notes

- Parse-first boundaries are enforced with `zod` in both clients and the Convex backend.
- Room policy is modeled as discriminated unions to keep invalid states unrepresentable.
- SpacetimeDB table shapes are indexed around room code and hot lookup paths.
- Convex backend uses typed schema/indexes and component-driven presence/rate limiting/workflow orchestration.
