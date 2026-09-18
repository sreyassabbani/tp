---
tags: [home, overview]
---

# Teleparty Clone Lab docs

This is the documentation entry point. The root [README](../README.md) stays intentionally short; detailed developer information lives here.

## Start by task

| I want to... | Read |
| --- | --- |
| run the project for the first time | [Getting started](getting-started.md) |
| see what each app actually supports | [Feature matrix](feature-matrix.md) |
| understand the repo shape | [Architecture overview](overview.md) |
| find a dev/build command | [Commands](commands.md) |
| fix a local setup problem | [Troubleshooting](troubleshooting.md) |
| understand environment variables/local state | [Environment](environment.md) |
| understand product schemas and parsing | [Domain model](domain-model.md) |
| understand the frontend | [Frontend overview](frontend-overview.md) |
| inspect the Convex implementation | [Convex backend](convex-backend.md) |
| inspect the SpacetimeDB implementation | [SpacetimeDB backend](spacetime-backend.md) |
| compare the realtime models | [Realtime comparison](realtime-comparison.md) |
| understand ownership/permissions | [Permissions and ownership](permissions-and-ownership.md) |
| trace cursor data end to end | [Data flow](data-flow.md) |
| see dependency/tooling choices | [Tech stack](tech-stack.md) |

## The three apps

- `apps/teleparty-convex` — main implementation, TanStack Start + Convex
- `apps/teleparty-spacetime` — main implementation, TanStack Start + SpacetimeDB
- `apps/teleparty-sveltekit` — frontend experiment on the Convex backend

The first two are the backend comparison. The SvelteKit app is a separate frontend experiment.

## Fast path

From the repo root:

```bash
direnv allow
just bootstrap
just convex-dev
```

Swap the last command for `just spacetime-dev` or `just sveltekit-dev` as needed.

For what those commands actually launch, use [Getting started](getting-started.md) and [Commands](commands.md).

## Documentation convention

- `README.md` answers “what is this?”
- `getting-started.md` is the canonical setup path
- `commands.md` is the command reference
- `feature-matrix.md` records current parity instead of assuming it
- backend/frontend pages explain implementation details
- `troubleshooting.md` owns reset and recovery procedures

`docs/` can be opened directly as an Obsidian vault, but all primary navigation uses normal Markdown links so the docs also work on GitHub.
