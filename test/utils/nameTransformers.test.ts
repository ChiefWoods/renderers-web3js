import { expect, test } from 'vitest';

import { DEFAULT_NAME_TRANSFORMERS, getNameApi } from '../../src/utils';

test('it applies default web3js naming conventions', () => {
    const nameApi = getNameApi(DEFAULT_NAME_TRANSFORMERS);

    expect(nameApi.instructionCreateFunction('transfer')).toBe('createTransferInstruction');
    expect(nameApi.accountFetchFunction('token')).toBe('fetchTokenAccount');
    expect(nameApi.pdaFindFunction('vault')).toBe('findVaultPda');
    expect(nameApi.programAddressConstant('memo')).toBe('MEMO_PROGRAM_ID');
});

test('it allows overriding individual transformers', () => {
    const nameApi = getNameApi({
        ...DEFAULT_NAME_TRANSFORMERS,
        instructionCreateFunction: (name, { pascalCase }) => `build${pascalCase(name)}Ix`,
    });

    expect(nameApi.instructionCreateFunction('transfer')).toBe('buildTransferIx');
    expect(nameApi.accountFetchFunction('token')).toBe('fetchTokenAccount');
});
