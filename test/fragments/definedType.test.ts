import {
    definedTypeNode,
    enumEmptyVariantTypeNode,
    enumStructVariantTypeNode,
    enumTupleVariantTypeNode,
    enumTypeNode,
    numberTypeNode,
    stringTypeNode,
    structFieldTypeNode,
    structTypeNode,
    tupleTypeNode,
} from '@codama/nodes';
import { expect, test } from 'vitest';

import { getDefinedTypeFragment } from '../../src/fragments/definedType';
import { getBorshSchemaVisitor, getTypeVisitor } from '../../src/visitors';

test('it generates discriminated union helper functions for data enums', () => {
    const node = definedTypeNode({
        name: 'event',
        type: enumTypeNode([
            enumEmptyVariantTypeNode('quit'),
            enumTupleVariantTypeNode('write', tupleTypeNode([stringTypeNode('utf8')])),
            enumStructVariantTypeNode(
                'move',
                structTypeNode([
                    structFieldTypeNode({ name: 'x', type: numberTypeNode('u32') }),
                    structFieldTypeNode({ name: 'y', type: numberTypeNode('u32') }),
                ]),
            ),
        ]),
    });

    const result = getDefinedTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain(
        `export function event(kind: 'Quit'): GetDiscriminatedUnionVariant<Event, '__kind', 'Quit'>;`,
    );
    expect(result.content).toContain('type GetDiscriminatedUnionVariant<');
    expect(result.content).toContain('type GetDiscriminatedUnionVariantContent<');
    expect(result.content).toContain(
        `export function event(kind: 'Write', data: GetDiscriminatedUnionVariantContent<Event, '__kind', 'Write'>['fields']): GetDiscriminatedUnionVariant<Event, '__kind', 'Write'>;`,
    );
    expect(result.content).toContain(
        `export function event(kind: 'Move', data: GetDiscriminatedUnionVariantContent<Event, '__kind', 'Move'>): GetDiscriminatedUnionVariant<Event, '__kind', 'Move'>;`,
    );
    expect(result.content).toContain(`export function isEvent<K extends Event['__kind']>`);
});

test('it does not generate discriminated union helper functions for non-enums', () => {
    const node = definedTypeNode({
        name: 'myStruct',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u8') })]),
    });

    const result = getDefinedTypeFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).not.toContain('// Data Enum Helpers.');
    expect(result.content).not.toContain('export function myStruct');
    expect(result.content).not.toContain('export function isMyStruct');
});
