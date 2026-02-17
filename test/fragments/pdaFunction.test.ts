import {
    bytesTypeNode,
    bytesValueNode,
    constantPdaSeedNode,
    constantPdaSeedNodeFromString,
    pdaNode,
    publicKeyTypeNode,
    stringTypeNode,
    variablePdaSeedNode,
} from '@codama/nodes';
import { expect, test } from 'vitest';

import { getPdaFunctionFragment } from '../../src/fragments/pdaFunction';
import { getTypeVisitor } from '../../src/visitors';

test('it generates PDA function with variable seeds', () => {
    const node = pdaNode({
        name: 'associatedToken',
        seeds: [
            variablePdaSeedNode('mint', publicKeyTypeNode()),
            variablePdaSeedNode('owner', publicKeyTypeNode()),
            constantPdaSeedNodeFromString('base58', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        ],
    });

    const result = getPdaFunctionFragment(node, getTypeVisitor(), 'DUMMYPRG_PROGRAM_ID');

    // Check Seeds interface
    expect(result.content).toContain('export interface AssociatedTokenPdaSeeds');
    expect(result.content).toContain('mint: PublicKey');
    expect(result.content).toContain('owner: PublicKey');

    // Check PDA function
    expect(result.content).toContain('export function findAssociatedTokenPda');
    expect(result.content).toContain('seeds: AssociatedTokenPdaSeeds');
    expect(result.content).toContain('programId: PublicKey = DUMMYPRG_PROGRAM_ID');
    expect(result.content).toContain('[PublicKey, number]');

    // Check seeds array
    expect(result.content).toContain('const seedsBuffer: Buffer[]');
    expect(result.content).toContain('seeds.mint.toBuffer()');
    expect(result.content).toContain('seeds.owner.toBuffer()');
    expect(result.content).toContain("Buffer.from('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'utf8')");

    // Check return statement
    expect(result.content).toContain('PublicKey.findProgramAddressSync(seedsBuffer, programId)');

    // Check imports
    expect(result.content).toContain("import { PublicKey } from '@solana/web3.js'");
    expect(result.content).toContain("import { DUMMYPRG_PROGRAM_ID } from '..';");
});

test('it generates PDA function with no variable seeds', () => {
    const node = pdaNode({
        name: 'config',
        seeds: [constantPdaSeedNodeFromString('utf8', 'config')],
    });

    const result = getPdaFunctionFragment(node, getTypeVisitor(), 'DUMMYPRG_PROGRAM_ID');

    // Should not have seeds interface
    expect(result.content).not.toContain('PdaSeeds');

    // Check PDA function with only programId parameter
    expect(result.content).toContain('export function findConfigPda');
    expect(result.content).toContain('programId: PublicKey = DUMMYPRG_PROGRAM_ID');
    expect(result.content).toContain('[PublicKey, number]');

    // Check constant seed
    expect(result.content).toContain("Buffer.from('config', 'utf8')");
});

test('it generates PDA function with string seeds', () => {
    const node = pdaNode({
        name: 'metadata',
        seeds: [constantPdaSeedNodeFromString('utf8', 'metadata'), variablePdaSeedNode('name', stringTypeNode('utf8'))],
    });

    const result = getPdaFunctionFragment(node, getTypeVisitor(), 'DUMMYPRG_PROGRAM_ID');

    expect(result.content).toContain('export interface MetadataPdaSeeds');
    expect(result.content).toContain('name: string');
    expect(result.content).toContain("Buffer.from(seeds.name, 'utf8')");
});

test('it handles empty seeds', () => {
    const node = pdaNode({
        name: 'global',
        seeds: [],
    });

    const result = getPdaFunctionFragment(node, getTypeVisitor(), 'DUMMYPRG_PROGRAM_ID');

    expect(result.content).toContain('export function findGlobalPda');
    expect(result.content).toContain('const seedsBuffer: Buffer[] = []');
});

test('it generates proper function signature', () => {
    const node = pdaNode({
        name: 'userAccount',
        seeds: [variablePdaSeedNode('authority', publicKeyTypeNode())],
    });

    const result = getPdaFunctionFragment(node, getTypeVisitor(), 'DUMMYPRG_PROGRAM_ID');

    // Check complete function signature
    expect(result.content).toMatch(
        /export function findUserAccountPda\(seeds: UserAccountPdaSeeds, programId: PublicKey = DUMMYPRG_PROGRAM_ID\): \[PublicKey, number\]/,
    );
});

test('it encodes constant byte seeds from their declared encoding', () => {
    const node = pdaNode({
        name: 'storageAccount',
        seeds: [constantPdaSeedNode(bytesTypeNode(), bytesValueNode('base58', '5NmF1bZtRi'))],
    });

    const result = getPdaFunctionFragment(node, getTypeVisitor());

    expect(result.content).toContain("Buffer.from(\"storage\", 'utf8')");
    expect(result.content).not.toContain("Buffer.from('5NmF1bZtRi', 'hex')");
});
