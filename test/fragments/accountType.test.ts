import { accountNode, numberTypeNode, publicKeyTypeNode, structFieldTypeNode, structTypeNode } from '@codama/nodes';
import { expect, test } from 'vitest';

import { getAccountTypeFragment } from '../../src/fragments/accountType';
import { getBorshSchemaVisitor, getTypeVisitor } from '../../src/visitors';

test('it generates account with struct data', () => {
    const node = accountNode({
        name: 'token',
        data: structTypeNode([
            structFieldTypeNode({ name: 'amount', type: numberTypeNode('u64') }),
            structFieldTypeNode({ name: 'owner', type: publicKeyTypeNode() }),
            structFieldTypeNode({ name: 'delegate', type: publicKeyTypeNode() }),
        ]),
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
    expect(result.content).toContain('const TokenAccountDataSchema');
    expect(result.content).toContain('struct([');
    expect(result.content).toContain("['amount', u64()]");
    expect(result.content).toContain("['owner', publicKey()]");
    expect(result.content).toContain("['delegate', publicKey()]");

    // Check deserialize function
    expect(result.content).toContain('export function deserializeTokenAccount(data: Buffer): TokenAccountData');
    expect(result.content).toContain('return deserialize(TokenAccountDataSchema, data)');

    // Check fetch function
    expect(result.content).toContain('export async function fetchTokenAccount');
    expect(result.content).toContain('connection: Connection');
    expect(result.content).toContain('address: PublicKey');
    expect(result.content).toContain('Promise<TokenAccount>');
    expect(result.content).toContain('const accountInfo = await connection.getAccountInfo(address)');
    expect(result.content).toContain('if (!accountInfo)');
    expect(result.content).toContain('throw new Error');
    expect(result.content).toContain('deserializeTokenAccount(accountInfo.data)');

    // Check imports
    expect(result.imports.get('web3')).toContain('PublicKey');
    expect(result.imports.get('web3')).toContain('Connection');
    expect(result.imports.get('borsh')).toContain('deserialize');
    expect(result.imports.get('borsh')).toContain('struct');
    expect(result.imports.get('borsh')).toContain('u64');
    expect(result.imports.get('borsh')).toContain('publicKey');
});

test('it generates account with simple data', () => {
    const node = accountNode({
        name: 'mint',
        data: structTypeNode([
            structFieldTypeNode({ name: 'supply', type: numberTypeNode('u64') }),
            structFieldTypeNode({ name: 'decimals', type: numberTypeNode('u8') }),
        ]),
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('export interface MintAccountData');
    expect(result.content).toContain('supply: bigint');
    expect(result.content).toContain('decimals: number');
    expect(result.content).toContain('export interface MintAccount');
    expect(result.content).toContain('const MintAccountDataSchema');
    expect(result.content).toContain('export function deserializeMintAccount');
    expect(result.content).toContain('export async function fetchMintAccount');
});

test('it generates proper error message in fetch function', () => {
    const node = accountNode({
        name: 'metadata',
        data: structTypeNode([structFieldTypeNode({ name: 'uri', type: numberTypeNode('u32') })]),
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain("throw new Error('Metadata account not found at address: ' + address.toBase58())");
});

test('it handles empty struct', () => {
    const node = accountNode({
        name: 'empty',
        data: structTypeNode([]),
    });

    const result = getAccountTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('export interface EmptyAccountData');
    expect(result.content).toContain('{}');
    expect(result.content).toContain('const EmptyAccountDataSchema = struct([])');
});
