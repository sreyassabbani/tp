---
tags: [reference, environment, configuration]
---

# Environment

<- [[index|Home]]

This repo assumes a Nix + direnv workflow.

---

## Root Environment

### `.envrc`
The repo root uses `direnv` to enter a pinned Nix dev shell.

That shell provides:
- Node.js
- Bun
- just
- Rust toolchain
- SpacetimeDB CLI

Run once after cloning:

```bash
cd /Users/sreysus/workflow/tp
direnv allow
```

---

## Convex Environment

File:
- `apps/teleparty-convex/.env.local`

Important variable:
- `VITE_CONVEX_URL`

How it is set:
- `bun run convex:dev` writes/refreshes the local Convex URL
- the frontend provider throws if the variable is missing

---

## Spacetime Environment

File:
- `apps/teleparty-spacetime/.env.local`

Important variables:
- `VITE_STDB_URL`
- `VITE_STDB_DATABASE`

Defaults in code:
- `ws://127.0.0.1:3010`
- `teleparty-spacetime`

Spacetime local data directory:
- `apps/teleparty-spacetime/.spacetime/data`

If local publish/auth state gets corrupted, removing that data directory and restarting is the usual reset path.

---

## Local Browser Storage

Both apps rely on local storage for anonymous browser identity.

Convex keys:
- room/browser session profile
- owner session secret

Spacetime keys:
- room/browser session profile
- cached Spacetime auth token

This means browser storage is part of the effective local environment for development.
