---
tags: [reference, troubleshooting, dev]
---

# Troubleshooting

Start with the repo-level commands. Most setup bugs come from bypassing the environment/orchestration layer.

## `bun`, `just`, or `spacetime` is missing

Make sure direnv has approved and entered the flake:

```bash
direnv allow
direnv reload
```

Then verify:

```bash
bun --version
just --version
spacetime --version
```

## Convex frontend says the backend URL is missing

Use the combined task:

```bash
just convex-dev
```

It starts Convex sync and waits for `apps/teleparty-convex/.env.local` to contain `VITE_CONVEX_URL` before starting Vite.

If you intentionally use the split workflow, start `just convex-backend` before `just convex-web`.

## SvelteKit is missing `PUBLIC_CONVEX_URL`

Start it through:

```bash
just sveltekit-dev
```

The repo wrapper derives `PUBLIC_CONVEX_URL` from the Convex dev environment. Running bare `bun run dev` inside the SvelteKit directory skips that wiring.

## Spacetime publish/start state is stuck

First stop the current local processes. Then reset the local database only if needed:

```bash
rm -rf apps/teleparty-spacetime/.spacetime/data
just spacetime-dev
```

This deletes local Spacetime room/data state.

## Spacetime frontend types do not match the module

Regenerate/publish once:

```bash
just spacetime-sync
```

If you use `just spacetime-dev`, the repo already watches module source and refreshes generated bindings.

## A port is already in use

Expected ports are 3001, 3002, 3003, and 3010.

On macOS/Linux, inspect a port with:

```bash
lsof -iTCP:3001 -sTCP:LISTEN -n -P
```

Replace `3001` with the conflicting port, then stop the stale process or run only the implementation you need.

## The embedded watch page is blank or refuses to load

That can be an external-site limitation rather than an app bug. Sites can block iframe embedding with CSP or frame headers.

YouTube URLs are normalized to `youtube-nocookie.com` embed URLs when recognized. Arbitrary URLs are still subject to the target site's embedding policy.

## I lost room-owner controls

Ownership is browser-local.

For Convex-backed apps, the browser stores a session ID plus an owner secret. Clearing site data, switching browser profiles, or using another device loses that local proof.

SpacetimeDB currently has a weaker session-ID-based owner model; see [Permissions and ownership](permissions-and-ownership.md).

## A build passes but the feature is broken

That is possible. The repo does not yet have a meaningful automated behavior test suite.

Use the manual smoke test in [Getting started](getting-started.md), especially after changes to realtime flows, permissions, or generated bindings.
