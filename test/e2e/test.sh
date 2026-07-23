#!/usr/bin/env bash
set -eux
# Dependencies are installed once at the workspace root (`bun install`).
bun run --filter './test/e2e/*' test
