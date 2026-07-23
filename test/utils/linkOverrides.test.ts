import { definedTypeLinkNode } from '@codama/nodes';
import { visit } from '@codama/visitors-core';
import { expect, test } from 'vitest';

import { getImportFromFactory, parseCustomDataOptions } from '../../src/utils';
import { getTypeVisitor } from '../../src/visitors';

test('it respects linkOverrides for defined type imports', () => {
    const getImportFrom = getImportFromFactory(
        { definedTypes: { counter: 'hooked' } },
        parseCustomDataOptions([], 'AccountData'),
        parseCustomDataOptions([], 'InstructionData'),
    );
    const result = visit(definedTypeLinkNode('counter'), getTypeVisitor({ getImportFrom }));

    expect(result.content).toBe('Counter');
    expect([...result.imports.keys()]).toContain('hooked');
});

test('it defaults defined type links to generatedTypes subpaths', () => {
    const result = visit(definedTypeLinkNode('counter'), getTypeVisitor());

    expect([...result.imports.keys()]).toContain('generatedTypes/counter');
});

test('custom account data registers import overrides for extracted type names', () => {
    const customAccountData = parseCustomDataOptions([{ importAs: 'tokenAccountData', name: 'token' }], 'AccountData');
    const getImportFrom = getImportFromFactory({}, customAccountData, parseCustomDataOptions([], 'InstructionData'));

    expect(getImportFrom(definedTypeLinkNode('tokenAccountData'))).toBe('hooked');
});
