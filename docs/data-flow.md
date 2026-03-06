---
tags: [architecture, data-flow, realtime]
---

# Data Flow - Shared Cursor Update

<- [[index|Home]] / [[overview]]

This page traces one high-frequency action through both implementations:

**a participant moves their mouse over the shared stage**

---

## The Full Journey

```text
User moves mouse over room stage
         |
         +--> React onMouseMove handler
                  |
                  v
        getRelativeCursorPosition()
                  |
                  v
        normalized x/y in [0, 1]
                  |
         +--------+--------+
         |                 |
         v                 v
     Convex path      Spacetime path
```

---

## Convex Path

```text
User moves mouse
         |
React onMouseMove
         |
rooms.$roomCode.tsx calls upsertCursor mutation
         |
Convex network request
         |
rooms.upsertCursor mutation validates payload
         |
cursorStates row is inserted or patched
         |
subscribed listCursors query updates
         |
React rerenders cursor labels
```

### Step Breakdown

1. `rooms.$roomCode.tsx` receives the browser mouse event.
2. `cursor-stage.ts` converts DOM coordinates into stage-relative percentages.
3. The frontend calls `api.rooms.upsertCursor`.
4. `convex/rooms.ts` validates the payload through the backend schema layer.
5. Convex writes the cursor row.
6. `listCursors` subscription pushes new query data back to the client.
7. The room rerenders the floating cursor labels.

This path has an explicit request/response boundary on every sampled cursor write.

---

## SpacetimeDB Path

```text
User moves mouse
         |
React onMouseMove
         |
rooms.$roomCode.tsx calls updateCursor reducer
         |
Spacetime reducer runs inside database runtime
         |
participant row is replaced with new cursor position
         |
replicated participant table updates in client
         |
React rerenders cursor labels
```

### Step Breakdown

1. `rooms.$roomCode.tsx` receives the browser mouse event.
2. `cursor-stage.ts` computes normalized coordinates.
3. The frontend calls the generated `updateCursor` reducer.
4. SpacetimeDB updates the participant row directly.
5. The `participant` table subscription changes in the client.
6. React rerenders using the new replicated row data.

This path removes the extra query-subscription loop used by the Convex version.

---

## Why The Difference Matters

Cursor movement is a hot path. The backend model is visible to the user.

Convex:
- clearer backend boundaries
- more backend round-trip shape on sampled cursor writes
- easier to reason about durable product logic

SpacetimeDB:
- better natural fit for hot replicated state
- lower perceived latency for cursors and presence
- more of the read path is just table sync

See [[realtime-comparison]].
