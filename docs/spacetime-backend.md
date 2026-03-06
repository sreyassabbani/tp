---
tags: [backend, spacetimedb, realtime]
---

# SpacetimeDB Backend

<- [[index|Home]] / [[overview]]

The Spacetime implementation is split across module source and generated frontend bindings.

---

## Files

```text
apps/teleparty-spacetime/spacetimedb/src/index.ts   # schema + reducers
apps/teleparty-spacetime/src/module_bindings/       # generated TS bindings
apps/teleparty-spacetime/src/integrations/spacetime/provider.tsx
```

Recommended local dev entry point:

```bash
cd /Users/sreysus/workflow/tp/apps/teleparty-spacetime
direnv exec /Users/sreysus/workflow/tp bun run spacetime:dev
```

That wraps the Spacetime CLI into one repo-level command instead of making you run server, publish/generate, and web in separate terminals.

---

## Public Tables

### `room`
Stores room metadata and room-wide soundboard settings.

### `participant`
Stores participant presence and cursor state directly in the replicated table.

### `soundEvent`
Stores recent soundboard events.

---

## Reducers

Key reducers:
- `createRoom`
- `joinRoom`
- `leaveRoom`
- `updateCursor`
- `triggerSound`
- `updateSoundboardPolicy`
- `cleanupRoom`

The reducer model means writes happen over the database connection, not through a separate HTTP mutation API.

---

## Client Read Path

The frontend reads tables through generated hooks such as `useTable(...)`.

Examples:
- room rows filtered by `roomCode`
- participant rows filtered by `roomCode`
- sound event rows filtered by `roomCode`

Because the participant table already carries cursor state, the room page does not need a second query just to render cursors.

---

## Connection Model

The provider creates a persistent database connection and caches the auth token in local storage.

Notable setting:
- `withConfirmedReads(false)` favors responsiveness over waiting for confirmed-read semantics

---

## Why This Backend Usually Feels Snappier for Cursors

The hot path is closer to:
- pointer move -> reducer
- replicated participant row updates
- subscribed table row changes in the client
- React rerender

That is a better fit for cursor/presence-style state than the explicit query/mutation subscription loop in the Convex variant.

See [[realtime-comparison]].
