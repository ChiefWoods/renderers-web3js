#!/usr/bin/env bash
set -eux

(cd test/e2e/system && pnpm install && pnpm test)
(cd test/e2e/token && pnpm install && pnpm test)
(cd test/e2e/memo && pnpm install && pnpm test)
