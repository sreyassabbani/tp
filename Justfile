set shell := ["zsh", "-cu"]

root := justfile_directory()

default:
  @just --list

# Install dependencies for both app variants and the Spacetime module package.
bootstrap:
  cd {{root}}/apps/teleparty-convex && direnv exec {{root}} bun install
  cd {{root}}/apps/teleparty-spacetime && direnv exec {{root}} bun install
  cd {{root}}/apps/teleparty-spacetime/spacetimedb && direnv exec {{root}} bun install

convex-backend:
  cd {{root}}/apps/teleparty-convex && direnv exec {{root}} bun run convex:dev

convex-web:
  cd {{root}}/apps/teleparty-convex && direnv exec {{root}} bun run dev

convex-build:
  cd {{root}}/apps/teleparty-convex && direnv exec {{root}} bun run build

spacetime-db:
  cd {{root}}/apps/teleparty-spacetime && direnv exec {{root}} bun run spacetime:start

spacetime-sync:
  cd {{root}}/apps/teleparty-spacetime && direnv exec {{root}} bun run spacetime:publish:local
  cd {{root}}/apps/teleparty-spacetime && direnv exec {{root}} bun run spacetime:generate

spacetime-web:
  cd {{root}}/apps/teleparty-spacetime && direnv exec {{root}} bun run dev

spacetime-build:
  cd {{root}}/apps/teleparty-spacetime && direnv exec {{root}} bun run spacetime:build
  cd {{root}}/apps/teleparty-spacetime && direnv exec {{root}} bun run build

build-all: convex-build spacetime-build
