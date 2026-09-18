---
tags: [reference, parity, features]
---

# Feature matrix

Feature parity between the two main implementations is a goal, not something to assume. This page records the current shape.

| Capability | Convex | SpacetimeDB | SvelteKit spike |
| --- | --- | --- | --- |
| create public/private rooms | yes | yes | yes, through Convex |
| anonymous browser identity | yes | yes | yes |
| shared cursors | yes | yes | yes |
| soundboard fanout | yes | yes | yes |
| room-size soundboard policy | yes | yes | yes |
| cursor mode | yes | yes | yes |
| interact-with-iframe mode | yes | yes | yes |
| shared drawing mode | no | **yes** | no |
| room-wide stage interaction policy | **yes** | no | **yes**, through Convex |
| per-participant stage-control grant | **yes** | no | **yes**, through Convex |
| owner secret beyond session ID | **yes** | no | **yes**, through Convex |
| generated backend/client bindings | Convex generated API | Spacetime generated module bindings | uses Convex API |
| dedicated backend comparison target | **yes** | **yes** | no |

## Important distinction: stage interaction is not synchronized playback

`interact` mode only decides whether the local iframe can receive pointer input.

It does **not** synchronize play, pause, seek, or playback time across browsers. True synchronized media control would require explicit shared playback state and provider-specific control APIs.

## Why the gaps exist

The repo is testing different programming models, not forcing every backend into exactly the same internal design.

Today:

- SpacetimeDB's replicated table model is used for shared drawing strokes.
- Convex has the more developed permission model, including an owner secret and participant capability grants.
- SvelteKit deliberately consumes the Convex backend instead of duplicating backend logic.

When a feature is added or removed, update this page rather than relying on prose that says the apps are “at parity.”
