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

## Nu workflow

Use the Nu task runner from the repo root as the canonical workflow:

```bash
cd /Users/sreysus/workflow/tp
nu scripts/tasks.nu bootstrap
```

Convex flow (recommended, one terminal):

```bash
nu scripts/tasks.nu convex-dev
```

Convex flow (manual / advanced split):

```bash
nu scripts/tasks.nu convex-backend
nu scripts/tasks.nu convex-web
```

Spacetime flow (recommended, one terminal):

```bash
nu scripts/tasks.nu spacetime-dev
```

Spacetime flow (manual / advanced split):

```bash
nu scripts/tasks.nu spacetime-db
nu scripts/tasks.nu spacetime-sync
nu scripts/tasks.nu spacetime-web
```

Build flow:

```bash
nu scripts/tasks.nu build-all
```

Command/process summary:

- `nu scripts/tasks.nu bootstrap`: installs Bun dependencies in all relevant packages.
- `nu scripts/tasks.nu convex-dev`: starts Convex backend sync, waits for the generated local URL, and then starts the web client on port `3001`.
- `nu scripts/tasks.nu convex-backend`: starts Convex backend/dev sync and keeps `.env.local` endpoints current.
- `nu scripts/tasks.nu convex-web`: starts the Convex web client on port `3001`.
- `nu scripts/tasks.nu spacetime-dev`: starts local SpacetimeDB dev mode, republishes/regenerates on changes, and runs the web client on port `3002`.
- `nu scripts/tasks.nu spacetime-db`: starts local SpacetimeDB on `127.0.0.1:3010` with data in `.spacetime/data`.
- `nu scripts/tasks.nu spacetime-sync`: publishes the Spacetime module and regenerates typed bindings.
- `nu scripts/tasks.nu spacetime-web`: starts the Spacetime web client on port `3002`.
- `nu scripts/tasks.nu build-all`: runs production builds for both implementations.

The `justfile` remains as a thin compatibility wrapper, but the real task logic now lives in Nu.

### Convex version

Recommended:

```bash
cd /Users/sreysus/workflow/tp
nu scripts/tasks.nu convex-dev
```

Why this is simpler:

- it runs backend sync and the web app together
- it waits for Convex to write `VITE_CONVEX_URL` before starting Vite
- it keeps the old split commands available when you want to inspect each process separately

Manual fallback:

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

Recommended:

```bash
cd /Users/sreysus/workflow/tp
nu scripts/tasks.nu spacetime-dev
```

Why this is simpler:

- it starts the local SpacetimeDB server if needed
- it does the initial publish and binding generation for you
- it keeps background publish and binding-refresh loops running on module changes
- it runs the Vite web app from the same entry point

Manual fallback:

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
