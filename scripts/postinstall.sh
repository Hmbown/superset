#!/bin/bash
# Prevent infinite recursion during postinstall
# electron-builder install-app-deps can trigger nested bun installs
# which would re-run postinstall, spawning hundreds of processes

if [ -n "$SUPERSET_POSTINSTALL_RUNNING" ]; then
  exit 0
fi

export SUPERSET_POSTINSTALL_RUNNING=1

# Each bun version names the node_modules/.bun store entries differently, and the
# mobile runtime version is a fingerprint of those paths. EAS installs with the
# pinned bun, so an install on another version gets a runtime no build has.
pinned_bun="$(cat "$(dirname "$0")/../.bun-version")"
if [ "$(bun --version)" != "$pinned_bun" ]; then
  echo "postinstall: bun $(bun --version) installed these dependencies, but .bun-version pins $pinned_bun." >&2
  echo "postinstall: apps/mobile will compute a different runtime version than EAS. Install bun $pinned_bun, then: rm -rf node_modules && bun install" >&2
fi

# Run sherif for workspace validation
sherif

# Materialize the compiled Lingui catalogs. They are generated, not committed,
# and turbo builds them for any task that goes through the graph — but a direct
# `bun run --filter=<pkg> typecheck` bypasses turbo, so a fresh clone would hit
# "Cannot find module '../locales/en/messages'". Non-fatal: a missing
# translation must fail a real build, not an install.
if ! bun run --filter=@superset/i18n build; then
  echo "postinstall: lingui compile failed; run 'bun run check:i18n' for details" >&2
fi

# GitHub CI runs multiple Bun install jobs that do not need desktop native rebuilds.
# Running electron-builder here can trigger nested Bun installs while the main
# install is still materializing packages, which has been flaky with native deps.
if [ -n "$CI" ]; then
  exit 0
fi

# Install native dependencies for desktop app
bun run --filter=@superset/desktop install:deps
