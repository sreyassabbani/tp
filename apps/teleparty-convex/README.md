# Teleparty — Convex

The Convex implementation of the Teleparty Clone Lab.

It uses TanStack Start + React for the frontend and Convex for queries, mutations, subscriptions, presence, rate limiting, and room-expiry workflows.

## Run

From the repository root:

```bash
direnv allow
just bootstrap
just convex-dev
```

Open `http://localhost:3001`.

For individual backend/web processes or build commands, see [`docs/commands.md`](../../docs/commands.md).

## Implementation notes

Backend code lives in `convex/`. Frontend code lives in `src/`.

This variant currently includes room-wide stage interaction policy and per-participant stage-control grants. Shared drawing is currently a SpacetimeDB-only feature.

See [Convex backend](../../docs/convex-backend.md) and the [feature matrix](../../docs/feature-matrix.md).
