---
tags: [architecture, tech-stack]
---

# Tech Stack

<- [[index|Home]] / [[overview]]

---

## Shared Frontend Stack

| Technology | Role | Why it is here |
|-----------|------|----------------|
| **TanStack Start** | App framework | File-based routes plus React SSR/client shell |
| **React 19** | UI library | Shared component model for both variants |
| **TypeScript** | Type system | Keeps the client and backend contracts explicit |
| **Zod** | Parse-first schemas | Normalizes room codes, watch URLs, and policy shapes |
| **Tailwind CSS 4** | Styling | Shared design tokens and utility styling |
| **shadcn-style UI primitives** | UI building blocks | Buttons, cards, inputs, sliders, switches |
| **Bun** | Package manager/runtime | Repo baseline per `AGENTS.md` |

---

## Convex Stack

| Technology | Role |
|-----------|------|
| **Convex** | Backend runtime, query/mutation model, subscriptions |
| **@convex-dev/presence** | Room presence tracking |
| **@convex-dev/rate-limiter** | Cursor and sound burst limiting |
| **@convex-dev/workflow** | Idle room expiry scheduling |

Convex is strongest when the app wants explicit backend functions and durable validation boundaries.

See [[convex-backend]].

---

## SpacetimeDB Stack

| Technology | Role |
|-----------|------|
| **SpacetimeDB 2.0.3** | Realtime database and reducer runtime |
| **Generated TypeScript bindings** | Typed client API to tables and reducers |
| **spacetimedb/react** | Connection provider, `useTable`, and reducer hooks |

SpacetimeDB is strongest when the app wants hot replicated state, especially for cursor/presence-like workloads.

See [[spacetime-backend]].

---

## Tooling

| Tool | Role |
|------|------|
| **Nix + direnv** | Pinned local toolchain |
| **just** | Canonical repo commands |
| **Vite** | Frontend build/dev server |
| **Biome** | Formatting and linting |
| **Vitest** | Test runner scaffold |

---

## Current Gaps

- There is no meaningful automated test suite yet.
- External embedding is provider-dependent.
- Feature parity between Convex and Spacetime is a goal, not a guarantee at every commit.
