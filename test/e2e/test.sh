#!/usr/bin/env bash
set -eux

(cd test/e2e/memo && pnpm install --force --no-frozen-lockfile && pnpm test)
(cd test/e2e/system_program && pnpm install --force --no-frozen-lockfile && pnpm test)
