# AGENTS.md

## Purpose

This repo compares two implementations of the same Teleparty-style product:

- `apps/teleparty-convex` — TanStack Start + Convex
- `apps/teleparty-spacetime` — TanStack Start + SpacetimeDB

`apps/teleparty-sveltekit` is a frontend experiment that uses the Convex backend. It is not part of the backend parity track.

## Working rules

- Make invalid states hard to represent.
- Parse inputs at boundaries instead of validating them late.
- Prefer typed/discriminated state over combinations of boolean flags.
- Keep React hooks unconditional and stable in order.
- Preserve deliberate UI quality; do not replace the interface with generic boilerplate.
- Do not claim feature parity without checking both implementations.

## Canonical workflow

Run development commands from the repo root:

```bash
direnv allow
just bootstrap
just convex-dev
just spacetime-dev
```

Useful alternatives:

```bash
just sveltekit-dev
just build-all
```

Use the split commands only when debugging individual processes. See `docs/commands.md`.

## Documentation rules

Keep `README.md` short. Put detailed setup in `docs/getting-started.md`, command details in `docs/commands.md`, and failures/reset procedures in `docs/troubleshooting.md`.

When behavior changes:

1. update `docs/feature-matrix.md` if parity changes;
2. update the relevant backend/frontend page;
3. avoid machine-specific absolute paths in documentation.

## Current gaps

- No meaningful automated test suite yet.
- External iframe embedding remains provider-dependent.
- Main-app parity is a target, not an invariant.
