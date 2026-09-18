# Teleparty — SvelteKit Spike

An experimental SvelteKit frontend over the existing Convex backend.

This is for testing route structure, interaction feel, motion, and component composition. It is not a third backend implementation.

## Run

From the repository root:

```bash
direnv allow
just bootstrap
just sveltekit-dev
```

Open `http://localhost:3003`.

The repo task starts Convex backend sync first and injects `PUBLIC_CONVEX_URL` into the SvelteKit app.

## Current scope

The spike uses the real Convex room, cursor, presence, permission, and soundboard state. It currently exposes the Convex-style cursor/interact stage modes; the shared drawing overlay remains SpacetimeDB-only.

See the [feature matrix](../../docs/feature-matrix.md).
