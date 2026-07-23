#!/usr/bin/env bash
set -eux
# Requires root deps installed and package built (`dist/`).
# Uses dist path in codama.json to avoid circular file: installs of the root package.
(cd test/e2e/anchor && bunx codama run demo)
(cd test/e2e/memo && bunx codama run demo)
(cd test/e2e/system_program && bunx codama run demo)
