import { accountNode, numberTypeNode, publicKeyTypeNode, structFieldTypeNode, structTypeNode } from '@codama/nodes';
import { expect, test } from 'vitest';

import { getAccountTypeFragment } from '../../src/fragments/accountType';
import { getBorshSchemaVisitor, getTypeVisitor } from '../../src/visitors';

test('it generates account with struct data', () => {
    const node = accountNode({
        data: structTypeNode([
            structFieldTypeNode({ name: 'amount', type: numberTypeNode('u64') }),
            structFieldTypeNode({ name: 'owner', type: publicKeyTypeNode() }),
            structFieldTypeNode({ name: 'delegate', type: publicKeyTypeNode() }),
        ]),
        name: 'token',
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    // Check AccountData interface
    expect(result.content).toContain('export interface TokenAccountData');
    expect(result.content).toContain('amount: bigint');
    expect(result.content).toContain('owner: PublicKey');
    expect(result.content).toContain('delegate: PublicKey');

    // Check Account interface
    expect(result.content).toContain('export interface TokenAccount');
    expect(result.content).toContain('address: PublicKey');
    expect(result.content).toContain('data: TokenAccountData');

    // Check Borsh schema
    expect(result.content).toContain('const TokenAccountDataCodec');
    expect(result.content).toContain('getStructCodec([');
    expect(result.content).toContain("['amount', getU64Codec()]");

    // Check deserialize function
    expect(result.content).toContain('export function deserializeTokenAccount(data: Uint8Array): TokenAccountData');
    expect(result.content).toContain('return TokenAccountDataCodec.decode(data)');

    // Check fetch function
    expect(result.content).toContain('export async function fetchTokenAccount');
    expect(result.content).toContain('connection: Connection');
    expect(result.content).toContain('address: PublicKey');
    expect(result.content).toContain('Promise<TokenAccount>');
    expect(result.content).toContain('const accountInfo = await connection.getAccountInfo(address)');
    expect(result.content).toContain('if (!accountInfo)');
    expect(result.content).toContain('throw new Error');
    expect(result.content).toContain('deserializeTokenAccount(accountInfo.data)');

    // Check fetchAll functions
    expect(result.content).toContain('export async function fetchAllMaybeTokenAccounts');
    expect(result.content).toContain('export async function fetchAllTokenAccounts');
    expect(result.content).toContain('connection.getMultipleAccountsInfo(addresses)');
    expect(result.content).toContain('Promise<(TokenAccount | null)[]>');
    expect(result.content).toContain('Promise<TokenAccount[]>');

    // Check imports
    expect(result.content).toContain("import { Connection, PublicKey } from '@solana/web3.js'");
    expect(result.content).toContain('import {');
    expect(result.content).toContain("from '@solana/codecs'");

    // No GPA when no size or discriminator
    expect(result.content).not.toContain('fetchProgramAccounts');
});

test('it generates account with simple data', () => {
    const node = accountNode({
        data: structTypeNode([
            structFieldTypeNode({ name: 'supply', type: numberTypeNode('u64') }),
            structFieldTypeNode({ name: 'decimals', type: numberTypeNode('u8') }),
        ]),
        name: 'mint',
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('export interface MintAccountData');
    expect(result.content).toContain('supply: bigint');
    expect(result.content).toContain('decimals: number');
    expect(result.content).toContain('export interface MintAccount');
    expect(result.content).toContain('const MintAccountDataCodec');
    expect(result.content).toContain('export function deserializeMintAccount');
    expect(result.content).toContain('export async function fetchMintAccount');
});

test('it generates proper error message in fetch function', () => {
    const node = accountNode({
        data: structTypeNode([structFieldTypeNode({ name: 'uri', type: numberTypeNode('u32') })]),
        name: 'metadata',
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain("throw new Error('Metadata account not found at address: ' + address.toBase58())");
});

test('it handles empty struct', () => {
    const node = accountNode({
        data: structTypeNode([]),
        name: 'empty',
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('export interface EmptyAccountData');
    expect(result.content).toContain('{}');
    expect(result.content).toContain('const EmptyAccountDataCodec = getStructCodec([])');
});

test('it generates fetchProgramAccounts when account has size', () => {
    const node = accountNode({
        data: structTypeNode([
            structFieldTypeNode({ name: 'version', type: numberTypeNode('u8') }),
            structFieldTypeNode({ name: 'authority', type: publicKeyTypeNode() }),
        ]),
        name: 'nonce',
        size: 80,
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('export async function fetchProgramAccountsNonce');
    expect(result.content).toContain('connection.getProgramAccounts(programId');
    expect(result.content).toContain('{ dataSize: 80 }');
    expect(result.content).toContain('Promise<NonceAccount[]>');
});

test('it does not generate fetchProgramAccounts when no size or discriminator', () => {
    const node = accountNode({
        data: structTypeNode([structFieldTypeNode({ name: 'data', type: numberTypeNode('u64') })]),
        name: 'unfilterable',
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).not.toContain('fetchProgramAccounts');
});
