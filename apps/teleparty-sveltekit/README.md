# Teleparty SvelteKit Spike

This app is an experimental SvelteKit frontend for the Teleparty Clone Lab.

It is intentionally not a third backend. Instead it focuses on:

- evaluating SvelteKit route and SSR ergonomics
- testing more editorial motion and visual direction
- running the real Teleparty room model against the existing Convex backend

## Run

From the repo root:

```bash
just sveltekit-dev
```

This starts the Convex backend sync and the SvelteKit app on `http://localhost:3003`.

## Build

From the repo root:

```bash
just sveltekit-build
```

That runs `svelte-check` and a production build with `PUBLIC_CONVEX_URL` wired from the Convex dev environment.

## Current model

- session state is stored locally in `localStorage`
- room, cursor, presence, and soundboard state come from the live Convex backend
- the stage currently follows the Convex feature surface: interact and cursor modes
- this app is the place to test design direction before deciding whether any ideas should move into the main Convex and Spacetime apps
