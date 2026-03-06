---
tags: [architecture, overview]
---

# Architecture Overview

<- [[index|Home]]

This repo contains two separate web apps that implement the same Teleparty-style behavior with different realtime backends.

---

## The Two Variants

| Variant | Frontend | Backend / Realtime | Default URL |
|--------|----------|--------------------|-------------|
| **Convex** | TanStack Start + React | Convex queries, mutations, subscriptions, and components | `http://localhost:3001` |
| **SpacetimeDB** | TanStack Start + React | SpacetimeDB tables, reducers, and client sync | `http://localhost:3002` |

The frontend shape is intentionally similar in both apps. The backend transport and state model are what change.

---

## High-Level Shape

```text
Browser UI
   |
   |  shared route structure + shared domain schema ideas
   |
   +--> Convex client -> Convex backend -> Convex tables/components
   |
   `--> SpacetimeDB client -> Spacetime reducers -> replicated tables
```

Both apps support the same product concepts:

- a room is identified by a generated room code, not by the watch URL
- the watch URL is parsed and normalized before use
- a room can be public or private
- shared cursors are rendered on top of the stage
- the soundboard is gated by room policy

See [[domain-model]].

---

## Why Two Backends?

The point of this repo is not abstract portability. It is direct comparison.

Convex emphasizes:
- explicit query and mutation boundaries
- backend validation and workflow orchestration
- subscription-driven UI updates

SpacetimeDB emphasizes:
- reducers as the write path
- replicated tables as the read path
- lower-friction realtime fanout for hot state

See [[realtime-comparison]].

---

## Monorepo Layout

```text
apps/teleparty-convex/
|- convex/                 # Convex schema and functions
`- src/                    # UI, routes, providers, shared client-side logic

apps/teleparty-spacetime/
|- spacetimedb/            # Spacetime schema and reducers
`- src/                    # UI, providers, generated module bindings
```

Shared repo-level concerns:
- `justfile` standardizes commands
- `direnv` + Nix provide the toolchain
- Bun is the package/runtime baseline

See [[commands]] and [[environment]].
