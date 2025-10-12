import { expect, test } from 'vitest';
import { createImportMap, getImportStatements, mergeImportMaps } from '../../src/utils/importMap';

test('it creates import maps', () => {
    const map = createImportMap([
        ['@solana/web3.js', ['PublicKey', 'Connection']],
        ['./types', 'MyType'],
    ]);
    expect(map.get('@solana/web3.js')).toEqual(new Set(['PublicKey', 'Connection']));
});

test('it generates import statements from import maps', () => {
    const map = createImportMap([
        ['@solana/web3.js', ['PublicKey', 'Connection']],
        ['./types', 'MyType'],
    ]);

    const statements = getImportStatements(map);

    expect(statements).toStrictEqual([
        "import { Connection, PublicKey } from '@solana/web3.js';",
        "import { MyType } from './types';",
    ]);
});

test('it sorts import names alphabetically', () => {
    const map = createImportMap([['@solana/web3.js', ['PublicKey', 'Connection', 'Transaction', 'AccountMeta']]]);

    const statements = getImportStatements(map);

    expect(statements).toEqual(["import { AccountMeta, Connection, PublicKey, Transaction } from '@solana/web3.js';"]);
});

test('it handles single imports', () => {
    const map = createImportMap([['@solana/web3.js', 'PublicKey']]);

    const statements = getImportStatements(map);

    expect(statements).toEqual(["import { PublicKey } from '@solana/web3.js';"]);
});
