---
tags: [architecture, overview]
---

# Architecture overview

The repo asks a narrow question: how does the same small realtime room product feel when implemented with different backend models?

## Applications

### Convex main app

`apps/teleparty-convex`

- TanStack Start + React frontend
- Convex queries/mutations/subscriptions
- Convex presence, rate limiting, and workflow components
- stronger room-owner/participant permission model

### SpacetimeDB main app

`apps/teleparty-spacetime`

- TanStack Start + React frontend
- SpacetimeDB TypeScript module
- reducers for writes
- replicated tables for reads
- generated TypeScript client bindings
- shared drawing overlay

### SvelteKit frontend spike

`apps/teleparty-sveltekit`

- SvelteKit frontend
- talks to the existing Convex backend
- exists to evaluate frontend composition and interaction feel
- is not a third backend in the comparison

See [Feature matrix](feature-matrix.md) before assuming the apps have identical features.

## Shared product model, separate implementations

The two main apps intentionally mirror concepts such as:

- room code and visibility
- watch URL parsing
- anonymous participant identity
- cursor position
- soundboard policy

They do **not** share one common package that guarantees identical behavior. The rules are implemented separately and can drift. Documentation and manual parity checks matter.

## State by temperature

A useful way to read the architecture is by update frequency.

### Durable / low-frequency

- room creation
- privacy
- ownership
- soundboard policy
- stage permissions

### Hot realtime

- cursor movement
- presence
- drawing strokes
- sound events

Convex and SpacetimeDB expose very different programming models for the second category. See [Realtime comparison](realtime-comparison.md) and [Data flow](data-flow.md).

## Repo-level orchestration

`justfile` is the public developer interface. `scripts/tasks.nu` handles the multi-process details behind it.

Nix + direnv provide the pinned toolchain; Bun is the package/runtime baseline.

For setup, use [Getting started](getting-started.md). For commands, use [Commands](commands.md).
