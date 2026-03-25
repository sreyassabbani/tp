# Teleparty Clone Lab (Convex + SpacetimeDB)

Documentation vault: `docs/index.md`

This repo contains two side-by-side implementations of the same Teleparty-style product:

- `apps/teleparty-convex` : TanStack Start + shadcn + Convex (with Presence, Rate Limiter, Workflow components)
- `apps/teleparty-spacetime` : TanStack Start + shadcn + SpacetimeDB v2.0 TypeScript module

There is also an experimental frontend spike:

- `apps/teleparty-sveltekit` : SvelteKit frontend experiment wired to the existing Convex backend, used to evaluate interaction feel, motion, and route composition outside the main parity track

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

## Justfile workflow

Use `just` from the repo root as the canonical workflow. The recipes are implemented in Nu under the hood.

```bash
cd /Users/sreysus/workflow/tp
just bootstrap
```

Convex flow (recommended, one terminal):

```bash
just convex-dev
```

Convex flow (manual / advanced split):

```bash
just convex-backend
just convex-web
```

Spacetime flow (recommended, one terminal):

```bash
just spacetime-dev
```

Spacetime flow (manual / advanced split):

```bash
just spacetime-db
just spacetime-sync
just spacetime-web
```

Build flow:

```bash
just build-all
```

Experimental SvelteKit spike:

```bash
just sveltekit-dev
just sveltekit-build
```

Command/process summary:

- `just bootstrap`: installs Bun dependencies in all relevant packages.
- `just convex-dev`: starts Convex backend sync, waits for the generated local URL, and then starts the web client on port `3001`.
- `just convex-backend`: starts Convex backend/dev sync and keeps `.env.local` endpoints current.
- `just convex-web`: starts the Convex web client on port `3001`.
- `just spacetime-dev`: starts local SpacetimeDB dev mode, republishes/regenerates on changes, and runs the web client on port `3002`.
- `just spacetime-db`: starts local SpacetimeDB on `127.0.0.1:3010` with data in `.spacetime/data`.
- `just spacetime-sync`: publishes the Spacetime module and regenerates typed bindings.
- `just spacetime-web`: starts the Spacetime web client on port `3002`.
- `just build-all`: runs production builds for both implementations.
- `just sveltekit-dev`: starts Convex backend sync and the experimental SvelteKit frontend on port `3003`.
- `just sveltekit-build`: runs `check` and production build for the experimental SvelteKit frontend with the Convex URL wired in.

### Convex version

Recommended:

```bash
cd /Users/sreysus/workflow/tp
just convex-dev
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
just spacetime-dev
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

### SvelteKit spike

Recommended:

```bash
cd /Users/sreysus/workflow/tp
just sveltekit-dev
```

Build:

```bash
cd /Users/sreysus/workflow/tp
just sveltekit-build
```

App URL: `http://localhost:3003`

This frontend now talks to the real Convex backend. It is still experimental, but it is no longer a fake local-only mock. The goal is to evaluate whether SvelteKit produces a meaningfully better frontend feel before deciding whether any ideas should migrate into the main apps.

## Design notes

- Parse-first boundaries are enforced with `zod` in both clients and the Convex backend.
- Room policy is modeled as discriminated unions to keep invalid states unrepresentable.
- SpacetimeDB table shapes are indexed around room code and hot lookup paths.
- Convex backend uses typed schema/indexes and component-driven presence/rate limiting/workflow orchestration.
