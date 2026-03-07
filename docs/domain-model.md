---
tags: [architecture, domain-model, data]
---

# Domain Model

<- [[index|Home]] / [[overview]]

The shared product rules live in Zod schemas rather than scattered UI checks.

---

## Core Concepts

### Room Code
A room is identified by a generated six-character code.

```text
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

Rules:
- 6 characters exactly
- excludes `I` and `O` to avoid visual ambiguity
- excludes `0` and `1` for the same reason

### Visibility
A room is one of:
- `public`
- `private` with a normalized access code

This is modeled as a discriminated union, not a boolean plus optional string.

### Soundboard Policy
A room soundboard policy is one of:
- `auto` - enabled up to a default participant threshold
- `manual` - owner controls enablement and threshold directly

### Stage Interaction Policy
A room stage policy is one of:
- `everyone`
- `owner_only`

Convex currently also supports participant grants for `stage_control` on top of the room-wide policy. See [[permissions-and-ownership]].

---

## Watch URL Parsing

Watch URLs are parsed through a shared schema before room creation.

Rules:
- must be a valid `http` or `https` URL
- YouTube URLs are normalized to embeddable iframe URLs
- the raw room identity is still the room code, not the URL

This is why link collisions are acceptable. Two rooms can use the same watch URL and still be distinct rooms.

---

## YouTube Normalization

Supported forms include:
- `youtube.com/watch?v=...`
- `youtu.be/...`
- `youtube.com/embed/...`
- `youtube.com/shorts/...`

The shared helper extracts:
- video ID
- optional start time from `start` or `t`

Then it produces a `youtube-nocookie.com/embed/...` URL.

---

## Why This Matters

This approach keeps invalid states harder to represent:
- no half-private rooms
- no malformed room codes downstream
- no manual string slicing for provider-specific embeds in the route layer

That is the main design rule of this repo: parse early and keep the rest of the app working with normalized data.
