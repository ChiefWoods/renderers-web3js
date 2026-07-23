import {
    accountNode,
    bytesTypeNode,
    bytesValueNode,
    constantNode,
    instructionNode,
    numberTypeNode,
    numberValueNode,
    programNode,
    publicKeyTypeNode,
    publicKeyValueNode,
    stringTypeNode,
    stringValueNode,
    structTypeNode,
} from '@codama/nodes';
import { expect, test } from 'vitest';

import { getConstantExportName, getProgramConstantsFragment } from '../../src/fragments/programConstants';

test('it exports program constants from the IDL', () => {
    const node = programNode({
        constants: [constantNode('seed', stringTypeNode('utf8'), stringValueNode('anchor'))],
        name: 'exponentVaults',
        publicKey: 'HycecAnELpjL1pMp435nEKWkcr7aNZ2QGQGXpzK1VEdV',
    });

    const result = getProgramConstantsFragment(node);

    expect(result.content).toContain('export const EXPONENTVAULTS_PROGRAM_ID');
    expect(result.content).toContain('export const SEED = "anchor";');
});

test('it exports bigint, bytes, and public key constants', () => {
    const node = programNode({
        constants: [
            constantNode('maxAmount', numberTypeNode('u64'), numberValueNode(42)),
            constantNode('discriminator', bytesTypeNode(), bytesValueNode('base16', 'deadbeef')),
            constantNode(
                'admin',
                publicKeyTypeNode(),
                publicKeyValueNode('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            ),
        ],
        name: 'test',
        publicKey: '11111111111111111111111111111111',
    });

    const result = getProgramConstantsFragment(node);

    expect(result.content).toContain('export const MAXAMOUNT = 42n;');
    expect(result.content).toContain("export const DISCRIMINATOR = Buffer.from('deadbeef', 'hex');");
    expect(result.content).toContain(
        'export const ADMIN = new Address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");',
    );
});

test('it decodes JSON-encoded anchor string constants', () => {
    const node = programNode({
        constants: [constantNode('seed', stringTypeNode('utf8'), stringValueNode('"anchor"'))],
        name: 'exponentVaults',
        publicKey: 'HycecAnELpjL1pMp435nEKWkcr7aNZ2QGQGXpzK1VEdV',
    });

    const result = getProgramConstantsFragment(node);

    expect(result.content).toContain('export const SEED = "anchor";');
});

test('getConstantExportName uppercases constant names', () => {
    expect(getConstantExportName('sEED')).toBe('SEED');
});

test('it omits internal nodes from barrel exports', () => {
    const node = programNode({
        accounts: [accountNode({ data: structTypeNode([]), name: 'hidden' })],
        instructions: [instructionNode({ name: 'visible' })],
        name: 'test',
        publicKey: '11111111111111111111111111111111',
    });

    const result = getProgramConstantsFragment(node, ['hidden']);

    expect(result.content).not.toContain("export * from './accounts/hidden'");
    expect(result.content).toContain("export * from './instructions/visible'");
});
