---
tags: [reference, commands, dev]
---

# Commands

Run `just` recipes from the repository root. They are the supported developer interface; `scripts/tasks.nu` implements them.

## Normal workflow

| Command | What it does |
| --- | --- |
| `just bootstrap` | installs dependencies for all three apps plus the Spacetime module |
| `just convex-dev` | runs Convex backend sync + the web app on port 3001 |
| `just spacetime-dev` | runs local SpacetimeDB + publish/generate watchers + web app on port 3002 |
| `just sveltekit-dev` | runs Convex backend sync + SvelteKit on port 3003 |
| `just build-all` | builds the Convex and Spacetime main implementations |
| `just convex-build` | builds the Convex app |
| `just spacetime-build` | builds the Spacetime module, then the web app |
| `just sveltekit-build` | runs Svelte checks, then builds the SvelteKit spike |

To list recipes:

```bash
just
```

## Split commands

Use these when debugging processes separately.

### Convex

```bash
just convex-backend
just convex-web
```

`convex-backend` runs Convex dev sync. `convex-web` runs Vite on port `3001`.

### SpacetimeDB

```bash
just spacetime-db
just spacetime-sync
just spacetime-web
```

- `spacetime-db` starts the local database on `127.0.0.1:3010`.
- `spacetime-sync` publishes the module and regenerates TypeScript bindings once.
- `spacetime-web` starts Vite on port `3002`.

If the module schema/reducers change while you are using the split workflow, rerun `just spacetime-sync`.

## Package-level checks

These bypass the repo orchestration and are mainly useful while debugging one app.

Convex:

```bash
cd apps/teleparty-convex
bun run check
bun run test
bun run convex:dev:once
```

SpacetimeDB:

```bash
cd apps/teleparty-spacetime
bun run check
bun run test
bun run spacetime:build
bun run spacetime:generate
```

SvelteKit:

```bash
cd apps/teleparty-sveltekit
bun run check
```

The current `test` scripts are scaffolding; the repo does not yet have a meaningful behavioral test suite.

## Ports

| Port | Service |
| --- | --- |
| `3001` | Convex web app |
| `3002` | Spacetime web app |
| `3003` | SvelteKit experiment |
| `3010` | local SpacetimeDB server |

See [Troubleshooting](troubleshooting.md) for port conflicts and reset procedures.
