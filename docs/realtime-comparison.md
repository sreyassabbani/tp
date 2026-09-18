---
tags: [architecture, realtime, comparison]
---

# Realtime comparison

This page compares the **current implementations in this repo**. It is not a general benchmark proving that one backend is faster than the other.

## The useful split

The product contains different classes of state.

### Low/medium-frequency state

- room creation
- privacy/access changes
- ownership and permissions
- soundboard policy

### Hot state

- cursor movement
- presence
- drawing strokes
- fast fanout events

The backend programming model becomes much more visible on hot state.

## Convex cursor path

Roughly:

```text
pointer sample
  -> Convex mutation
  -> cursor row write
  -> subscribed query data updates
  -> remote cursor rerenders
```

The implementation also paints the local cursor optimistically, so the user's own cursor does not wait for the network path.

Convex makes backend function boundaries explicit and gives durable product logic a clear query/mutation model.

## SpacetimeDB cursor path

Roughly:

```text
pointer sample
  -> reducer
  -> participant row write
  -> replicated table update
  -> remote cursor rerenders
```

The local cursor is also optimistic.

Because cursor state is already part of the replicated participant table, there are fewer application-level read/write abstractions in this path.

## What the repo currently suggests

For this specific implementation, SpacetimeDB provides a more direct programming model for replicated cursor/drawing state.

Convex provides a more explicit function-oriented boundary for room policy, permissions, and workflow-style logic.

Those are architectural observations. They are **not** yet latency measurements.

## What is not established

The repo currently has no controlled benchmark for:

- event-to-remote-paint latency (p50/p95/p99)
- throughput under many participants
- bytes transferred per cursor sample
- server/client CPU cost
- reconnect behavior under packet loss
- cost at equivalent workload
- consistency tradeoffs under failure

Without those measurements, “SpacetimeDB is faster” would be too broad a conclusion.

## Existing tuning

The current clients already avoid several self-inflicted costs:

- outbound cursor updates are sampled rather than sent for every raw pointer event;
- local cursors render optimistically;
- Convex cursor updates no longer rewrite participant-profile metadata on every pointer sample;
- Convex room-liveness updates are rate-limited relative to cursor traffic.

These changes make the comparison less about obviously wasteful client behavior and more about backend shape.

## If you benchmark this later

Measure the same action under the same conditions:

1. timestamp a sampled pointer event;
2. timestamp local optimistic paint separately;
3. timestamp the corresponding remote paint;
4. repeat with multiple room sizes;
5. report distributions, not just averages;
6. record network traffic and backend write/reducer rates.

That would turn the current architectural comparison into evidence about actual runtime behavior.
