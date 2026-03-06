---
tags: [backend, convex, realtime]
---

# Convex Backend

<- [[index|Home]] / [[overview]]

The Convex implementation lives in `apps/teleparty-convex/convex/`.

---

## Files

```text
convex/
|- schema.ts      # table definitions and indexes
|- domain.ts      # parse-first backend schema layer
|- rooms.ts       # room queries, mutations, and cleanup logic
|- presence.ts    # presence component wrapper
`- workflows.ts   # idle-room expiry workflow
```

---

## Tables

### `rooms`
Stores durable room metadata:
- room code
- watch URL and host
- visibility
- owner identity
- soundboard policy
- stage interaction policy
- archived state

### `cursorStates`
Stores the last known cursor position per participant in a room.

### `roomParticipantProfiles`
Stores stable participant metadata used by the UI:
- session ID
- display name
- color
- last seen timestamp

### `roomCapabilityGrants`
Stores participant-level capability exceptions such as `stage_control`.

### `soundboardEvents`
Stores recent soundboard events for playback fanout and event history.

---

## Convex Components

### Presence
`@convex-dev/presence` tracks who is online in a room.

### Rate Limiter
`@convex-dev/rate-limiter` caps:
- cursor burst traffic
- soundboard burst traffic

### Workflow
`@convex-dev/workflow` schedules room expiry after inactivity.

---

## Read Path

Important queries:
- `listPublicRooms`
- `getRoom`
- `listCursors`
- `listSoundEvents`
- `defaultRoomPolicy`

`getRoom` is the main room hydration query. It assembles:
- room metadata
- online participant count
- participant profiles
- participant capability grants

---

## Write Path

Important mutations:
- `createRoom`
- `upsertParticipantProfile`
- `upsertCursor`
- `triggerSound`
- `updateSoundboardPolicy`
- `updateStageInteractionPolicy`
- `setParticipantCapabilities`

The Convex model is explicit: each write is a backend mutation and each hot UI view subscribes to queries.

---

## Why Convex Can Feel Slower Here

Convex is doing more request/response work on the hot path:
- cursor move -> mutation
- backend write -> subscription invalidation
- subscribed query reruns -> UI update

That is a reasonable model for product logic, but it is less ideal for extremely hot cursor loops than direct replicated-state systems.

This repo now avoids an extra self-inflicted cost in that path:
- cursor updates no longer also rewrite participant-profile rows
- room liveness heartbeats only touch room activity once per minute at most

See [[realtime-comparison]].
