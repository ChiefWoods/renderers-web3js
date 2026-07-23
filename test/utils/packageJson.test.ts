import { expect, test } from 'vitest';

import { createNewPackageJson, updateExistingPackageJson } from '../../src/utils/packageJson';

test('it creates a package.json with used dependencies', () => {
    const packageJson = createNewPackageJson({
        '@solana/codecs': '^3.0.3',
        '@solana/web3.js': '3.0.0-rc.2',
    });

    expect(packageJson.name).toBe('js-client');
    expect(packageJson.dependencies).toEqual({
        '@solana/codecs': '^3.0.3',
        '@solana/web3.js': '3.0.0-rc.2',
    });
});

test('it adds missing dependencies to an existing package.json', () => {
    const packageJson = updateExistingPackageJson(
        { name: 'existing', dependencies: { leftpad: '1.0.0' } },
        { '@solana/web3.js': '3.0.0-rc.2' },
    );

    expect(packageJson.dependencies).toEqual({
        '@solana/web3.js': '3.0.0-rc.2',
        leftpad: '1.0.0',
    });
});
