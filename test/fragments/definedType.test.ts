import {
    arrayTypeNode,
    definedTypeNode,
    enumEmptyVariantTypeNode,
    enumStructVariantTypeNode,
    enumTupleVariantTypeNode,
    enumTypeNode,
    fixedCountNode,
    numberTypeNode,
    stringTypeNode,
    structFieldTypeNode,
    structTypeNode,
    tupleTypeNode,
} from '@codama/nodes';
import { LinkableDictionary, NodeStack } from '@codama/visitors-core';
import { expect, test } from 'vitest';

import { getDefinedTypeFragment } from '../../src/fragments/definedType';
import { DEFAULT_NAME_TRANSFORMERS, getImportFromFactory, getNameApi, parseCustomDataOptions } from '../../src/utils';
import { getTypeManifestVisitor } from '../../src/visitors';

function createTypeManifestVisitor() {
    return getTypeManifestVisitor({
        customAccountData: parseCustomDataOptions([], 'AccountData'),
        customInstructionData: parseCustomDataOptions([], 'InstructionData'),
        getImportFrom: getImportFromFactory(
            {},
            parseCustomDataOptions([], 'AccountData'),
            parseCustomDataOptions([], 'InstructionData'),
        ),
        linkables: new LinkableDictionary(),
        nameApi: getNameApi(DEFAULT_NAME_TRANSFORMERS),
        nonScalarEnums: [],
        stack: new NodeStack(),
    });
}

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

    const result = getDefinedTypeFragment(node, createTypeManifestVisitor());

    expect(result.content).toContain(`export function event(kind: 'Quit'): GetDiscriminatedUnionVariant<EventArgs`);
    expect(result.content).toContain('GetDiscriminatedUnionVariant');
    expect(result.content).toContain('GetDiscriminatedUnionVariantContent');
    expect(result.content).toContain(
        `export function event(kind: 'Write', data: GetDiscriminatedUnionVariantContent<EventArgs, '__kind', 'Write'>['fields']): GetDiscriminatedUnionVariant<EventArgs, '__kind', 'Write'>;`,
    );
    expect(result.content).toContain(
        `export function event(kind: 'Move', data: GetDiscriminatedUnionVariantContent<EventArgs, '__kind', 'Move'>): GetDiscriminatedUnionVariant<EventArgs, '__kind', 'Move'>;`,
    );
    expect(result.content).toContain(`export function isEvent<K extends Event['__kind']>`);
    expect(result.content).toContain('export function getEventEncoder(): Encoder<EventArgs>');
    expect(result.content).toContain('export function getEventDecoder(): Decoder<Event>');
    expect(result.content).toContain('export function getEventCodec(): Codec<EventArgs, Event>');
    expect(result.content).toContain('getDiscriminatedUnionEncoder');
    expect(result.content).toContain('getDiscriminatedUnionDecoder');
    expect(result.content).not.toContain('as unknown as Codec');
});

test('it generates codec for tuple defined types', () => {
    const node = definedTypeNode({
        name: 'myTuple',
        type: tupleTypeNode([numberTypeNode('u32'), stringTypeNode('utf8')]),
    });

    const result = getDefinedTypeFragment(node, createTypeManifestVisitor());

    expect(result.content).toContain('export type MyTuple = ');
    expect(result.content).toContain('export function getMyTupleEncoder()');
    expect(result.content).toContain('export function getMyTupleDecoder()');
    expect(result.content).toContain('getTupleEncoder');
    expect(result.content).toContain('getTupleDecoder');
});

test('it does not generate discriminated union helper functions for non-enums', () => {
    const node = definedTypeNode({
        name: 'myStruct',
        type: structTypeNode([structFieldTypeNode({ name: 'value', type: numberTypeNode('u8') })]),
    });

    const result = getDefinedTypeFragment(node, createTypeManifestVisitor());

    expect(result.content).not.toContain('// Data Enum Helpers.');
    expect(result.content).not.toContain('export function myStruct');
    expect(result.content).not.toContain('export function isMyStruct');
});

test('it generates codec for tuple-based defined types', () => {
    const node = definedTypeNode({
        name: 'number',
        type: tupleTypeNode([arrayTypeNode(numberTypeNode('u64'), fixedCountNode(4))]),
    });

    const result = getDefinedTypeFragment(node, createTypeManifestVisitor());

    expect(result.content).toContain('getNumberEncoder');
    expect(result.content).toContain('getNumberDecoder');
    expect(result.content).toContain('getTupleEncoder');
    expect(result.content).toContain('getTupleDecoder');
});
