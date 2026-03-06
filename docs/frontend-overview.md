---
tags: [frontend, react, tanstack-start]
---

# Frontend Overview

<- [[index|Home]] / [[overview]]

Both app variants use nearly the same frontend structure. The main difference is the provider and data-access layer.

---

## Route Shape

```text
src/
|- routes/
|  |- __root.tsx           # document shell + provider wrapper
|  |- index.tsx            # room creation + public room list
|  `- rooms.$roomCode.tsx  # live room view
|- lib/
|  |- teleparty-domain.ts  # shared schemas and helpers
|  |- session.ts           # anonymous browser identity
|  |- cursor-stage.ts      # stage coordinate math
|  `- soundboard.ts        # sound metadata + playback helpers
`- integrations/
   |- convex/provider.tsx
   `- spacetime/provider.tsx
```

---

## Route Responsibilities

### `__root.tsx`
- sets document `<head>` metadata
- loads global styles
- mounts the backend-specific provider
- wraps the page with shared header/footer chrome

### `index.tsx`
- loads the local browser session profile
- validates room creation inputs through Zod
- creates rooms
- lists public rooms

### `rooms.$roomCode.tsx`
- validates the room code from the URL
- joins or loads a room
- renders the shared stage iframe
- sends cursor updates
- shows soundboard events
- exposes owner controls when the current browser owns the room

---

## Shared Client-Side Ideas

### Anonymous Session Profile
Each browser stores a local profile with:
- `sessionId`
- `displayName`
- `color`

Convex additionally stores a local `sessionSecret` to prove room ownership without forcing account login. See [[permissions-and-ownership]].

### Parse-First Inputs
The UI does not trust raw strings late. It parses early:
- watch URLs
- room codes
- access codes
- soundboard policy
- stage interaction policy

See [[domain-model]].

### Stage Interaction Modes
The room stage uses two local modes:
- `cursor` - shared cursor tracking stays active over the stage
- `interact` - the iframe becomes clickable so the user can start or control playback

This is a browser limitation tradeoff, not a backend limitation. Cross-origin iframes swallow pointer events.

---

## Provider Difference

### Convex
The app wraps the tree in a `ConvexProvider` with a `ConvexReactClient`.

### SpacetimeDB
The app wraps the tree in a `SpacetimeDBProvider` with a persistent database connection and generated bindings.

That one change cascades into a very different data flow. See [[data-flow]] and [[realtime-comparison]].
