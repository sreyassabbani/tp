---
tags: [architecture, domain-model, data]
---

# Domain model

The product concepts are shared across implementations, but the validation code is not literally one shared package.

- Frontend boundaries use Zod schemas.
- Convex mirrors the rules in its backend domain/validator layer.
- SpacetimeDB normalizes and rejects reducer inputs inside the module.

That distinction matters: parity is maintained deliberately rather than guaranteed by code sharing.

## Room code

A room code is exactly six characters from:

```text
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

`I`, `O`, `0`, and `1` are omitted to reduce visual ambiguity.

Room identity comes from the room code, not the watch URL. Two rooms may point at the same URL.

## Visibility

A room is either:

- public; or
- private with an access code.

Convex models this as a discriminated union. SpacetimeDB stores normalized fields but enforces the same product distinction at reducer boundaries.

## Soundboard policy

The product has two policy modes:

- `auto` — enabled while the participant count stays under the default threshold;
- `manual` — owner controls whether it is enabled and the allowed participant count.

The current capacity range is 2–64 participants, with an automatic default of 8.

## Stage interaction

The Convex-backed product has a room-wide stage policy:

- `everyone`
- `owner_only`

Convex also supports participant capability grants. The current UI actively uses `stage_control` grants so selected participants can interact with the stage even when the room-wide policy is owner-only.

SpacetimeDB does not currently mirror this permission model. See [Feature matrix](feature-matrix.md).

## Watch URLs

Watch URLs must use HTTP or HTTPS.

Recognized YouTube forms include:

- `youtube.com/watch?v=...`
- `youtu.be/...`
- `youtube.com/embed/...`
- `youtube.com/shorts/...`

The frontend extracts a valid video ID, preserves recognized `start`/`t` offsets, and produces a `youtube-nocookie.com/embed/...` URL.

Other URLs remain ordinary URLs and may still fail to embed if the external provider blocks iframes.

## Design rule

Parse once at the boundary, then let the rest of the app operate on normalized data.

That reduces states such as malformed room codes, half-configured private rooms, and ad-hoc provider URL parsing deep inside route components.
