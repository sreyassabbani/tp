---
tags: [backend, spacetimedb, realtime]
---

# SpacetimeDB backend

The implementation is split between the database module and generated frontend bindings.

## Key files

```text
apps/teleparty-spacetime/
├── spacetimedb/src/index.ts
├── src/module_bindings/
└── src/integrations/spacetime/provider.tsx
```

Normal local development should start from the repo root:

```bash
just spacetime-dev
```

That handles server startup, initial publish, binding generation, source watching, and the frontend.

## Public tables

### `room`

Stores room metadata, visibility/access code, owner session ID, soundboard policy, activity timestamps, and archive state.

### `participant`

Stores participant identity, connection ID, last-seen time, and cursor position.

### `drawingStroke`

Stores shared stage drawing strokes as normalized point payloads.

### `soundEvent`

Stores recent soundboard events.

## Reducers

Important reducers include:

- `createRoom`
- `joinRoom` / `leaveRoom`
- `updateCursor`
- `triggerSound`
- `addDrawingStroke` / `clearDrawingStrokes`
- `updateSoundboardPolicy`
- `cleanupRoom`

The module validates/normalizes reducer inputs before writing table state.

## Read path

The frontend subscribes to generated table bindings. Room, participant, sound, and drawing rows become reactive client state without an application-level query function for each read.

For cursors, the participant row already contains the last cursor position.

## Generated bindings

`src/module_bindings/` is generated from the module schema.

With the normal `just spacetime-dev` workflow, module changes trigger binding regeneration. With the split workflow, rerun:

```bash
just spacetime-sync
```

after schema/reducer changes.

## Connection model

The frontend maintains a persistent database connection and caches Spacetime auth state locally.

The provider uses `withConfirmedReads(false)`, favoring responsive local subscription behavior over waiting for confirmed-read semantics.

## Ownership limitation

SpacetimeDB currently identifies the room owner by `ownerSessionId`. It does not mirror Convex's additional owner secret or participant capability-grant model.

That is sufficient for this prototype comparison but should not be treated as strong authentication.

See [Permissions and ownership](permissions-and-ownership.md) and [Feature matrix](feature-matrix.md).

## Realtime implication

The cursor path is structurally short:

```text
pointer sample
  -> updateCursor reducer
  -> participant row changes
  -> replicated row reaches clients
  -> remote cursor rerenders
```

That makes replicated-table systems interesting for hot room state, but this repo does not yet contain a controlled latency benchmark. See [Realtime comparison](realtime-comparison.md).
