# Teleparty Clone Lab

A small lab for building the same realtime watch-room product with different backend models.

The two main implementations intentionally aim at the same product:

| App | Frontend | Realtime/backend | Local URL |
| --- | --- | --- | --- |
| `teleparty-convex` | TanStack Start + React | Convex | `http://localhost:3001` |
| `teleparty-spacetime` | TanStack Start + React | SpacetimeDB 2.0 | `http://localhost:3002` |
| `teleparty-sveltekit` | SvelteKit | the existing Convex backend | `http://localhost:3003` |

The SvelteKit app is a frontend experiment, not a third backend implementation.

## Start here

The repo is designed to be run from its root.

```bash
direnv allow
just bootstrap
```

Then start one app:

```bash
just convex-dev
# or
just spacetime-dev
# or
just sveltekit-dev
```

`just convex-dev` and `just spacetime-dev` are the normal development entry points. The lower-level split commands still exist for debugging.

## What the product does

Across the main implementations, the product includes room creation, public/private rooms, anonymous browser identity, shared cursors, and a soundboard with room-size policy.

The implementations are not perfectly feature-identical at every commit. Notable differences today include:

- SpacetimeDB has the shared drawing overlay.
- Convex has room-wide stage permissions plus per-participant stage-control grants.
- The SvelteKit spike follows the Convex backend feature surface but intentionally experiments with a different frontend structure.

See [Feature matrix](docs/feature-matrix.md) for the current comparison.

> This is not synchronized video playback. The iframe is embedded in each browser independently. Play/pause/scrub inside one browser does not automatically control every participant's player.

## Documentation

If this is your first time in the repo, read [Getting started](docs/getting-started.md).

Then use:

- [Docs home](docs/index.md) — where to look for a particular question
- [Architecture overview](docs/overview.md) — how the repo is split
- [Feature matrix](docs/feature-matrix.md) — what is actually implemented in each variant
- [Commands](docs/commands.md) — every supported `just` workflow
- [Environment](docs/environment.md) — generated URLs, local data, and browser state
- [Troubleshooting](docs/troubleshooting.md) — common local failures
- [Convex backend](docs/convex-backend.md) — tables, queries, mutations, and components
- [SpacetimeDB backend](docs/spacetime-backend.md) — tables, reducers, bindings, and connection model
- [Realtime comparison](docs/realtime-comparison.md) — the architectural comparison, with its limits

The `docs/` directory is also an Obsidian vault.

## Repo layout

```text
tp/
├── apps/
│   ├── teleparty-convex/       # TanStack Start + Convex
│   ├── teleparty-spacetime/    # TanStack Start + SpacetimeDB
│   └── teleparty-sveltekit/    # SvelteKit frontend experiment on Convex
├── docs/                       # architecture + developer docs
├── scripts/tasks.nu            # implementation behind the just recipes
├── justfile                    # canonical developer commands
├── flake.nix                   # pinned dev toolchain
└── AGENTS.md                   # repo rules for coding agents
```

## Known limits

- There is no meaningful automated test suite yet; builds and type/tool checks are not a substitute for behavioral tests.
- External sites may refuse iframe embedding through their own security policy.
- Browser-local identity means clearing local storage can remove your local ownership proof.
- The realtime comparison is an implementation study, not a general benchmark of Convex versus SpacetimeDB.
