import solanaConfig from '@solana-config/oxc/oxlint';
import { defineConfig } from 'oxlint';

export default defineConfig({
    extends: [solanaConfig],
    ignorePatterns: ['**/dist/**', '**/e2e/**'],
    options: { typeAware: true },
    overrides: [
        {
            files: ['test/**/*.ts'],
            rules: {
                'typescript/no-unsafe-argument': 'off',
                'typescript/no-unsafe-assignment': 'off',
                'typescript/no-unsafe-call': 'off',
                'typescript/no-unsafe-member-access': 'off',
            },
        },
    ],
    rules: { 'sort-keys': 'off' },
});
