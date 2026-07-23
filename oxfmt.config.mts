import solanaFmt from '@solana-config/oxc/oxfmt';
import { defineConfig } from 'oxfmt';

export default defineConfig({
    ...solanaFmt,
    ignorePatterns: [
        'test/e2e/',
        '.changeset/',
        '.github/workflows/PULL_REQUEST_TEMPLATE.md',
        'declarations/',
        'dist/',
        'doc/',
        'lib/',
        'test-ledger/',
        'target/',
        'CHANGELOG.md',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'bun.lock',
    ],
});
