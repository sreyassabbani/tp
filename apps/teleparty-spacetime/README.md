# Teleparty — SpacetimeDB

The SpacetimeDB implementation of the Teleparty Clone Lab.

It uses TanStack Start + React with a SpacetimeDB 2.0 TypeScript module and generated client bindings.

## Run

From the repository root:

```bash
direnv allow
just bootstrap
just spacetime-dev
```

Open `http://localhost:3002`. The local SpacetimeDB server listens on `127.0.0.1:3010`.

`just spacetime-dev` starts the database when needed, publishes the module, regenerates TypeScript bindings, watches module changes, and runs the web app.

For the split workflow, see [`docs/commands.md`](../../docs/commands.md).

## Implementation notes

- Module source: `spacetimedb/src/index.ts`
- Generated client bindings: `src/module_bindings/`
- Frontend: `src/`

This variant currently has the shared drawing overlay. Its ownership model is intentionally simpler than the Convex variant and does not mirror Convex's per-participant stage grants.

See [SpacetimeDB backend](../../docs/spacetime-backend.md), [feature matrix](../../docs/feature-matrix.md), and [troubleshooting](../../docs/troubleshooting.md).
