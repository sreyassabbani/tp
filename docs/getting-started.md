---
tags: [getting-started, setup, dev]
---

# Getting started

This is the canonical first-run path.

## 1. Enter the dev environment

The host machine needs Nix and direnv. The repo's Nix flake supplies Node, Bun, `just`, Rust, and the pinned SpacetimeDB CLI.

From the repo root:

```bash
direnv allow
```

After approval, entering the directory should activate the development shell automatically.

If `bun`, `just`, or `spacetime` is missing, stop here and see [Troubleshooting](troubleshooting.md).

## 2. Install project dependencies

```bash
just bootstrap
```

This installs dependencies for:

- `apps/teleparty-convex`
- `apps/teleparty-spacetime`
- `apps/teleparty-spacetime/spacetimedb`
- `apps/teleparty-sveltekit`

Run it again after dependency changes.

## 3. Start one implementation

### Convex

```bash
just convex-dev
```

Open `http://localhost:3001`.

The task starts Convex dev sync, waits until `VITE_CONVEX_URL` exists, and then starts the frontend.

### SpacetimeDB

```bash
just spacetime-dev
```

Open `http://localhost:3002`.

The task:

1. starts local SpacetimeDB on `127.0.0.1:3010` if needed;
2. publishes the module;
3. generates TypeScript bindings;
4. watches module source and refreshes bindings;
5. starts the frontend.

### SvelteKit experiment

```bash
just sveltekit-dev
```

Open `http://localhost:3003`.

This starts the same Convex backend used by the Convex app, then launches the SvelteKit frontend with `PUBLIC_CONVEX_URL` injected.

## 4. Smoke-test the app

A useful manual check is:

1. create a public room;
2. open the room in a second tab/window;
3. verify participant/cursor updates;
4. trigger a sound and confirm it fans out;
5. create a private room and verify the access-code gate.

Then test implementation-specific behavior:

- Convex: change stage policy and grant/revoke stage control for a participant.
- SpacetimeDB: draw on the shared stage, then clear drawings as the room owner.
- SvelteKit: verify the same Convex room can be opened through the experimental frontend.

## 5. Build

```bash
just build-all
```

Or build individually:

```bash
just convex-build
just spacetime-build
just sveltekit-build
```

There is not yet a meaningful automated behavior test suite, so a successful build does not establish feature correctness.

## Next

- [Feature matrix](feature-matrix.md)
- [Commands](commands.md)
- [Architecture overview](overview.md)
- [Troubleshooting](troubleshooting.md)
