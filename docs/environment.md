---
tags: [reference, environment, configuration]
---

# Environment

The repo assumes Nix + direnv and is designed to be operated from the repository root.

## Root dev shell

`.envrc` enters the flake-defined shell. The shell supplies the project toolchain, including:

- Node.js 24
- Bun
- `just`
- Rust/Cargo
- SpacetimeDB CLI 2.0.3

First-time approval:

```bash
direnv allow
```

If the shell becomes stale after changing `flake.nix`, use:

```bash
direnv reload
```

## Convex

Generated/local file:

```text
apps/teleparty-convex/.env.local
```

Important variable:

- `VITE_CONVEX_URL` — the current Convex backend URL used by the TanStack app

`just convex-dev` waits for Convex dev sync to write this value before it starts the frontend.

The SvelteKit task reads the same value and injects it as `PUBLIC_CONVEX_URL`.

In normal development, do not hand-maintain these URLs.

## SpacetimeDB

Frontend variables:

- `VITE_STDB_URL`
- `VITE_STDB_DATABASE`

Code defaults:

- URL: `ws://127.0.0.1:3010`
- database: `teleparty-spacetime`

Local database state lives under:

```text
apps/teleparty-spacetime/.spacetime/data
```

Deleting that directory resets local SpacetimeDB state. Do that only when you intentionally want a fresh local database or need to recover from corrupted/stale local state.

## Browser-local state

The apps use local storage for anonymous identity.

Convex-backed frontends store a browser session profile and an owner session secret. SpacetimeDB stores a browser session profile and its connection/auth state.

Consequences:

- identity is browser-local rather than account-based;
- incognito windows behave like separate users;
- clearing site data can remove the browser's ownership proof.

This browser state is part of the effective development environment. See [Permissions and ownership](permissions-and-ownership.md).
