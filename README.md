# Teleparty Clone Lab (Convex + SpacetimeDB)

Documentation vault: `docs/index.md`

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

## Justfile workflow

Use `just` from the repo root to run the nix+direnv+Bun commands consistently.

```bash
cd /Users/sreysus/workflow/tp
just bootstrap
```

Convex flow (two terminals):

```bash
just convex-backend
just convex-web
```

Spacetime flow (three terminals):

```bash
just spacetime-db
just spacetime-sync
just spacetime-web
```

Build flow:

```bash
just build-all
```

Command/process summary:

- `just bootstrap`: installs Bun dependencies in all relevant packages.
- `just convex-backend`: starts Convex backend/dev sync and keeps `.env.local` endpoints current.
- `just convex-web`: starts the Convex web client on port `3001`.
- `just spacetime-db`: starts local SpacetimeDB on `127.0.0.1:3010` with data in `.spacetime/data`.
- `just spacetime-sync`: publishes the Spacetime module and regenerates typed bindings.
- `just spacetime-web`: starts the Spacetime web client on port `3002`.
- `just build-all`: runs production builds for both implementations.

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
