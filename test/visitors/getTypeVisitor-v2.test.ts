import {
    accountNode,
    arrayTypeNode,
    booleanTypeNode,
    bytesTypeNode,
    definedTypeNode,
    definedTypeLinkNode,
    enumEmptyVariantTypeNode,
    enumTypeNode,
    numberTypeNode,
    optionTypeNode,
    publicKeyTypeNode,
    remainderCountNode,
    stringTypeNode,
    structFieldTypeNode,
    structTypeNode,
} from '@codama/nodes';
import { visit } from '@codama/visitors-core';
import { expect, test } from 'vitest';

import { getTypeVisitor } from '../../src/visitors/getTypeVisitor-v2';

test('it renders u64 as bigint', () => {
    const result = visit(numberTypeNode('u64'), getTypeVisitor());

    expect(result.content).toBe('bigint');
});

test('it renders u32 as number', () => {
    const result = visit(numberTypeNode('u32'), getTypeVisitor());

    expect(result.content).toBe('number');
});

test('it renders u8 as number', () => {
    const result = visit(numberTypeNode('u8'), getTypeVisitor());
    expect(result.content).toBe('number');
});

test('it renders u128 as bigint', () => {
    const result = visit(numberTypeNode('u128'), getTypeVisitor());
    expect(result.content).toBe('bigint');
});

test('it renders boolean types', () => {
    const result = visit(booleanTypeNode(), getTypeVisitor());
    expect(result.content).toBe('boolean');
});

test('it renders bytes as Uint8Array', () => {
    const result = visit(bytesTypeNode(), getTypeVisitor());
    expect(result.content).toBe('Uint8Array');
});

test('it renders string types', () => {
    const result = visit(stringTypeNode('utf8'), getTypeVisitor());
    expect(result.content).toBe('string');
});

test('it renders PublicKey with import', () => {
    const result = visit(publicKeyTypeNode(), getTypeVisitor());
    console.log('RESULT', result);
    expect(result.content).toBe('PublicKey');
    expect(result.imports.get('web3')).toContain('PublicKey');
});

test('it renders array types', () => {
    const result = visit(arrayTypeNode(stringTypeNode('utf8'), remainderCountNode()), getTypeVisitor());
    expect(result.content).toBe('Array<string>');
});

test('it renders option types as nullable', () => {
    const result = visit(optionTypeNode(numberTypeNode('u64')), getTypeVisitor());
    expect(result.content).toBe('bigint | null');
});

test('it renders struct types as interfaces with export', () => {
    const result = visit(
        definedTypeNode({
            name: 'person',
            type: structTypeNode([
                structFieldTypeNode({ name: 'name', type: stringTypeNode('utf8') }),
                structFieldTypeNode({ name: 'age', type: numberTypeNode('u32') }),
            ]),
        }),
        getTypeVisitor(),
    );
    expect(result.content).toBe('export interface Person { name: string; age: number }');
});

test('it renders enum types with export', () => {
    const result = visit(
        definedTypeNode({
            name: 'direction',
            type: enumTypeNode([
                enumEmptyVariantTypeNode('up'),
                enumEmptyVariantTypeNode('right'),
                enumEmptyVariantTypeNode('down'),
                enumEmptyVariantTypeNode('left'),
            ]),
        }),
        getTypeVisitor(),
    );
    expect(result.content).toBe('export enum Direction { Up, Right, Down, Left }');
});

test('it renders defined type links with import', () => {
    const result = visit(
        structTypeNode([structFieldTypeNode({ name: 'customField', type: definedTypeLinkNode('myCustomType') })]),
        getTypeVisitor(),
    );
    expect(result.content).toContain('MyCustomType');
    expect(result.imports.get('generatedTypes/myCustomType')).toContain('MyCustomType');
});

test('it renders accounts as interfaces', () => {
    const result = visit(
        accountNode({
            data: structTypeNode([
                structFieldTypeNode({ name: 'amount', type: numberTypeNode('u64') }),
                structFieldTypeNode({ name: 'owner', type: publicKeyTypeNode() }),
            ]),
            name: 'token',
        }),
        getTypeVisitor(),
    );
    expect(result.content).toContain('export interface Token');
    expect(result.content).toContain('amount: bigint');
    expect(result.content).toContain('owner: PublicKey');
    expect(result.imports.get('web3')).toContain('PublicKey');
});
