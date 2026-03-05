# AGENTS.md

## Purpose
This repo hosts two Teleparty-style web apps that share the same product behavior but use different realtime backends:

- `apps/teleparty-convex` (Convex)
- `apps/teleparty-spacetime` (SpacetimeDB v2.0)

Both should stay feature-parity aligned.

## Core Principles

- Make invalid states unrepresentable.
- Parse, do not validate late.
- Prefer typed/discriminated unions over boolean-flag combinations.
- Keep hooks unconditional and stable in order.
- Preserve good UI/UX and non-boilerplate design quality.

## Environment Conventions

- Nix + direnv are the default workflow (`direnv allow` at repo root).
- Bun is the package/runtime baseline (pnpm was removed).
- Use `justfile` recipes from repo root for day-to-day workflows.

## Quick Commands

Bootstrap:

```bash
just bootstrap
```

Convex (2 terminals):

```bash
just convex-backend
just convex-web
```

Spacetime (3 terminals):

```bash
just spacetime-db
just spacetime-sync
just spacetime-web
```

Build both:

```bash
just build-all
```

## Project Notes

- URL input is parsed through shared domain schema.
- Room identity is by room code, not watch URL.
- YouTube links are normalized to embeddable iframe URLs.
- Soundboard policy should be modeled and edited as a discriminated state.

## Known Gaps

- No meaningful test suite yet (`bun run test` currently reports no tests).
- External site embedding remains provider-dependent.
