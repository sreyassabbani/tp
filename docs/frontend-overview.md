---
tags: [frontend, react, tanstack-start, sveltekit]
---

# Frontend overview

There are two closely matched TanStack Start frontends plus one SvelteKit experiment.

## TanStack app shape

Both main apps follow roughly:

```text
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   └── rooms.$roomCode.tsx
├── lib/
│   ├── teleparty-domain.ts
│   ├── session.ts
│   ├── cursor-stage.ts
│   └── soundboard.ts
└── integrations/
    └── <backend provider>
```

The route responsibilities are intentionally similar so the backend comparison is not dominated by unrelated frontend differences.

## Room route responsibilities

The live room route handles:

- room-code parsing and private-room access
- anonymous session identity
- room/presence hydration
- cursor publication and rendering
- soundboard events
- stage-mode switching
- owner controls where the backend supports them

## Stage modes are not identical

### Convex TanStack app

- `cursor` — overlay captures pointer movement for shared cursors
- `interact` — iframe receives pointer input

### SpacetimeDB TanStack app

- `cursor`
- `interact`
- `draw` — overlay records and replicates drawing strokes

### SvelteKit spike

The SvelteKit frontend currently follows the Convex surface:

- `cursor`
- `interact`

See [Feature matrix](feature-matrix.md).

## Why cursor rendering has two paths

Both main apps paint the local cursor optimistically so your own pointer does not need to wait for a backend round trip.

Remote cursors still arrive through each backend's realtime model:

- Convex: mutations + subscribed query data
- SpacetimeDB: reducer writes + replicated participant rows

Both implementations also sample/throttle outbound pointer traffic rather than sending every raw device event.

## Cross-origin iframe constraint

The cursor/draw overlay and the iframe compete for pointer events. When `interact` is active, the iframe must receive them; when an overlay tool is active, the overlay must receive them.

That is why stage mode exists at all. It is primarily a browser/iframe interaction constraint, not a backend constraint.

## SvelteKit experiment

`apps/teleparty-sveltekit` uses the live Convex backend but decomposes the UI into Svelte components such as lobby panels, stage panels, owner controls, and session cards.

Its purpose is to test frontend ergonomics and design direction without adding another backend to the comparison.
