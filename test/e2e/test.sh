#!/usr/bin/env bash
set -eux
(cd test/e2e/anchor && bun install --force && bun test)
(cd test/e2e/memo && bun install --force && bun test)
(cd test/e2e/system_program && bun install --force && bun test)
