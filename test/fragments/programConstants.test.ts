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
import { LinkableDictionary, NodeStack } from '@codama/visitors-core';
import { expect, test } from 'vitest';

import {
    getConstantExportName,
    getConstantsFragment,
    getProgramConstantsFragment,
} from '../../src/fragments/programConstants';
import { DEFAULT_NAME_TRANSFORMERS, getImportFromFactory, getNameApi, parseCustomDataOptions } from '../../src/utils';
import { getTypeManifestVisitor } from '../../src/visitors';

function createTypeManifestVisitor() {
    const customAccountData = parseCustomDataOptions([], 'AccountData');
    const customInstructionData = parseCustomDataOptions([], 'InstructionData');
    return getTypeManifestVisitor({
        customAccountData,
        customInstructionData,
        getImportFrom: getImportFromFactory({}, customAccountData, customInstructionData),
        linkables: new LinkableDictionary(),
        nameApi: getNameApi(DEFAULT_NAME_TRANSFORMERS),
        nonScalarEnums: [],
        stack: new NodeStack(),
    });
}

test('it exports program constants from the IDL', () => {
    const node = programNode({
        constants: [constantNode('seed', stringTypeNode('utf8'), stringValueNode('anchor'))],
        name: 'exponentVaults',
        publicKey: 'HycecAnELpjL1pMp435nEKWkcr7aNZ2QGQGXpzK1VEdV',
    });

    const result = getConstantsFragment(node, createTypeManifestVisitor());

    expect(result.content).toContain('export const SEED: string = "anchor";');
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

    const result = getConstantsFragment(node, createTypeManifestVisitor());

    expect(result.content).toContain('export const MAX_AMOUNT: bigint = 42n;');
    expect(result.content).toContain(
        "export const DISCRIMINATOR: ReadonlyUint8Array = Buffer.from('deadbeef', 'hex');",
    );
    expect(result.content).toContain(
        'export const ADMIN: Address = new Address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");',
    );
});

test('it decodes JSON-encoded anchor string constants', () => {
    const node = programNode({
        constants: [constantNode('seed', stringTypeNode('utf8'), stringValueNode('"anchor"'))],
        name: 'exponentVaults',
        publicKey: 'HycecAnELpjL1pMp435nEKWkcr7aNZ2QGQGXpzK1VEdV',
    });

    const result = getConstantsFragment(node, createTypeManifestVisitor());

    expect(result.content).toContain('export const SEED: string = "anchor";');
});

test('getConstantExportName uses screaming snake case', () => {
    expect(getConstantExportName('maxAmount')).toBe('MAX_AMOUNT');
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

    expect(result.content).not.toContain("export * from './accounts';");
    expect(result.content).toContain("export * from './instructions';");
});

test('it exports constants through a top-level constants barrel', () => {
    const node = programNode({
        constants: [constantNode('seed', stringTypeNode('utf8'), stringValueNode('anchor'))],
        name: 'test',
        publicKey: '11111111111111111111111111111111',
    });

    const result = getProgramConstantsFragment(node);

    expect(result.content).toContain("export * from './constants';");
});
