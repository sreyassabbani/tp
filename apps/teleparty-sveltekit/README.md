# Teleparty SvelteKit Spike

This app is an experimental SvelteKit frontend spike for the Teleparty Clone Lab.

It is intentionally not a third parity backend implementation. Instead it focuses on:

- evaluating SvelteKit route and SSR ergonomics
- testing more editorial motion and visual direction
- exploring local-first room, cursor, drawing, and soundboard interactions

## Run

From the repo root:

```bash
just sveltekit-dev
```

The app runs on `http://localhost:3003`.

## Build

From the repo root:

```bash
just sveltekit-build
```

That runs `svelte-check` and a production build.

## Current model

- room/session state is stored locally in `localStorage`
- room creation uses the shared Teleparty parsing rules adapted for SvelteKit
- stage tools include interact, cursor, and draw modes
- this app is the place to test design direction before deciding whether any ideas should move into the main Convex and Spacetime apps
