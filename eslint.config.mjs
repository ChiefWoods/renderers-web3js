import solanaConfig from '@solana/eslint-config-solana';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    { ignores: ['**/dist/**', '**/e2e/**'] },
    { files: ['**/*.ts', '**/*.(c|m)?js'], extends: [solanaConfig] },
    {
        files: ['test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
        },
    },
]);
