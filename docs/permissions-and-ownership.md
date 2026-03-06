---
tags: [architecture, auth, permissions]
---

# Permissions and Ownership

<- [[index|Home]] / [[overview]]

This project uses low-friction browser identity instead of full user accounts.

---

## Anonymous Browser Identity

A local browser session profile is created automatically. There is no Google login, no password prompt, and no central user table.

### Shared fields
- `sessionId`
- `displayName`
- `color`

### Convex-only owner proof
Convex additionally stores:
- `sessionSecret`

That secret lives in local storage and acts as the owner proof for room-management mutations.

This means:
- ownership is browser-scoped
- clearing local storage loses that browser's owner key
- there is no cross-device recovery flow

That is acceptable for a casual room app, but it is not strong account auth.

---

## Room Owner

In Convex, room ownership is currently defined as:
- the browser that created the room
- proven by `ownerSessionId + ownerSessionSecret`

Owner-only actions include:
- updating soundboard policy
- updating stage interaction policy
- granting participant stage-control capability

---

## Stage Control

The shared stage is an iframe plus cursor overlay.

There are two separate concerns:

### Room-wide policy
- `everyone`
- `owner_only`

### Participant-level grants (Convex)
A room owner can also grant `stage_control` to individual participants.

This is useful when the room-wide policy is `owner_only` but one or two guests should still be able to click the embed.

---

## Important Limitation

Stage-control permission is still local UI permission.

The embed is not a synchronized shared player. Clicking play inside your browser affects your iframe, not everybody else's. So stage-control grants are about who may interact with the local room-stage UI, not global playback authority.

If you want true shared play/pause/scrub, that is a separate synchronized-state feature.

---

## Current Parity Note

Convex currently has the stronger ownership model:
- anonymous owner secret
- participant stage grants

SpacetimeDB still uses the simpler room-owner session model and does not yet mirror the same participant-grant system.
