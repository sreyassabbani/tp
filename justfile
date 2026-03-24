set shell := ["nu", "-c"]

root := justfile_directory()

default:
  @just --list

# Install dependencies for both app variants and the Spacetime module package.
bootstrap:
  nu {{root}}/scripts/tasks.nu bootstrap

convex-backend:
  nu {{root}}/scripts/tasks.nu convex-backend

convex-web:
  nu {{root}}/scripts/tasks.nu convex-web

convex-dev:
  nu {{root}}/scripts/tasks.nu convex-dev

convex-build:
  nu {{root}}/scripts/tasks.nu convex-build

spacetime-dev:
  nu {{root}}/scripts/tasks.nu spacetime-dev

spacetime-db:
  nu {{root}}/scripts/tasks.nu spacetime-db

spacetime-sync:
  nu {{root}}/scripts/tasks.nu spacetime-sync

spacetime-web:
  nu {{root}}/scripts/tasks.nu spacetime-web

spacetime-build:
  nu {{root}}/scripts/tasks.nu spacetime-build

sveltekit-dev:
  nu {{root}}/scripts/tasks.nu sveltekit-dev

sveltekit-build:
  nu {{root}}/scripts/tasks.nu sveltekit-build

build-all: convex-build spacetime-build
