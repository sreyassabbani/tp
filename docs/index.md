---
tags: [home, overview]
---

# Teleparty Clone Lab - Documentation

Welcome to the Teleparty Clone Lab documentation vault. This repo contains two implementations of the same product:

- `apps/teleparty-convex` - TanStack Start + Convex
- `apps/teleparty-spacetime` - TanStack Start + SpacetimeDB

Both variants aim for feature parity, but the realtime transport and backend programming model are intentionally different.

---

## Navigation

### Architecture
- [[overview]] - What this repo is and how the pieces fit together
- [[tech-stack]] - Libraries, runtimes, and tooling
- [[data-flow]] - A single realtime action traced end to end
- [[realtime-comparison]] - Why Convex and Spacetime feel different in practice

### Shared Product Model
- [[frontend-overview]] - Shared UI structure and route layout
- [[domain-model]] - Shared Zod schemas, room rules, and URL parsing
- [[permissions-and-ownership]] - Anonymous browser identity, owner controls, and participant grants

### Backend Implementations
- [[convex-backend]] - Convex schema, functions, and components
- [[spacetime-backend]] - Spacetime tables, reducers, and generated bindings

### Reference
- [[commands]] - Daily dev commands and build flows
- [[environment]] - Runtime variables and local environment expectations

---

## Quick Start

```bash
cd /Users/sreysus/workflow/tp
direnv allow
just bootstrap
```

Convex flow:

```bash
just convex-backend
just convex-web
```

Spacetime flow:

```bash
just spacetime-db
just spacetime-sync
just spacetime-web
```

Build both:

```bash
just build-all
```

---

## Project Structure

```text
tp/
|- apps/
|  |- teleparty-convex/
|  |  |- convex/          # Convex schema + functions
|  |  `- src/             # TanStack Start frontend
|  `- teleparty-spacetime/
|     |- spacetimedb/     # SpacetimeDB module source
|     `- src/             # TanStack Start frontend + generated bindings
|- docs/                  # This documentation vault
|- AGENTS.md              # Repo-specific instructions for coding agents
|- justfile               # Canonical dev commands
`- README.md              # High-level repo summary
```

---

## What This Project Is For

This repo is not just a single app. It is a side-by-side lab for comparing two realtime backends against the same product:

- room creation from arbitrary watch links
- shared cursor overlays
- soundboard events
- room visibility and access codes
- owner controls and participant permissions

If you are trying to understand why one implementation feels better than the other, start with [[realtime-comparison]].
