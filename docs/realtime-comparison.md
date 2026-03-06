---
tags: [architecture, realtime, comparison]
---

# Realtime Comparison

<- [[index|Home]] / [[overview]]

If Convex feels slower than SpacetimeDB in this repo, that is not surprising.

---

## Short Version

This product has two kinds of state:

### Cold or medium-frequency state
- room creation
- privacy changes
- soundboard policy
- ownership and permissions

### Hot state
- cursor movement
- presence
- fast fanout UI updates

Convex handles the first category very naturally.
SpacetimeDB is a better fit for the second.

---

## Why Convex Feels Slower Here

The Convex implementation uses:
- frontend mutation calls for writes
- backend table writes
- subscribed queries for reads

That is a perfectly good application architecture, but it is not the fastest possible shape for a pointer loop.

Every cursor update still looks roughly like:

```text
client event -> mutation -> backend write -> query refresh/subscription -> rerender
```

For room controls, policies, and durable metadata, that is fine.
For cursors, it is more overhead than the Spacetime path.

---

## Why SpacetimeDB Fits This Workload Better

The Spacetime implementation keeps hot room state directly in replicated tables.

That makes the shape closer to:

```text
client event -> reducer -> replicated row update -> rerender
```

Less orchestration is needed to keep cursors feeling live.

---

## What This Means For This Repo

If the main product goal is:
- shared cursors
- live room state
- eventually synchronized controls

then SpacetimeDB is probably the more natural long-term backend for this app.

If the main product goal is:
- explicit backend validation
- mutation/query ergonomics
- simpler durable business logic workflows

then Convex is still a solid choice, but it will need more careful tuning on hot interaction paths.

---

## Recent Convex Cleanup

This repo now avoids two avoidable Convex costs:
- cursor updates no longer rewrite participant-profile metadata
- room liveness heartbeats only bump `lastActivityAt` once per minute at most

Those changes reduce write churn, but they do not change the underlying architectural tradeoff.

---

## Recommendation

If you care most about the room *feeling* realtime, try the Spacetime variant next.

That is the honest comparison this repo is set up to make.
