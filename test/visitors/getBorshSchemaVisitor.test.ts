import {
    arrayTypeNode,
    booleanTypeNode,
    bytesTypeNode,
    definedTypeLinkNode,
    enumEmptyVariantTypeNode,
    enumStructVariantTypeNode,
    enumTupleVariantTypeNode,
    enumTypeNode,
    fixedCountNode,
    numberTypeNode,
    optionTypeNode,
    publicKeyTypeNode,
    remainderCountNode,
    stringTypeNode,
    structFieldTypeNode,
    structTypeNode,
    tupleTypeNode,
} from '@codama/nodes';
import { visit } from '@codama/visitors-core';
import { expect, test } from 'vitest';

import { getBorshSchemaVisitor } from '../../src/visitors/getBorshSchemaVisitor';

test('it generates u8 schema', () => {
    const result = visit(numberTypeNode('u8'), getBorshSchemaVisitor());
    expect(result.content).toBe('u8()');
    expect(result.imports.get('borsh')).toContain('u8');
});

test('it generates u16 schema', () => {
    const result = visit(numberTypeNode('u16'), getBorshSchemaVisitor());
    expect(result.content).toBe('u16()');
    expect(result.imports.get('borsh')).toContain('u16');
});

test('it generates u32 schema', () => {
    const result = visit(numberTypeNode('u32'), getBorshSchemaVisitor());
    expect(result.content).toBe('u32()');
    expect(result.imports.get('borsh')).toContain('u32');
});

test('it generates u64 schema', () => {
    const result = visit(numberTypeNode('u64'), getBorshSchemaVisitor());
    expect(result.content).toBe('u64()');
    expect(result.imports.get('borsh')).toContain('u64');
});

test('it generates u128 schema', () => {
    const result = visit(numberTypeNode('u128'), getBorshSchemaVisitor());
    expect(result.content).toBe('u128()');
    expect(result.imports.get('borsh')).toContain('u128');
});

test('it generates i64 schema', () => {
    const result = visit(numberTypeNode('i64'), getBorshSchemaVisitor());
    expect(result.content).toBe('i64()');
    expect(result.imports.get('borsh')).toContain('i64');
});

test('it generates bool schema', () => {
    const result = visit(booleanTypeNode(), getBorshSchemaVisitor());
    expect(result.content).toBe('bool()');
    expect(result.imports.get('borsh')).toContain('bool');
});

test('it generates string schema', () => {
    const result = visit(stringTypeNode('utf8'), getBorshSchemaVisitor());
    expect(result.content).toBe('str()');
    expect(result.imports.get('borsh')).toContain('str');
});

test('it generates bytes schema', () => {
    const result = visit(bytesTypeNode(), getBorshSchemaVisitor());
    expect(result.content).toBe('bytes()');
    expect(result.imports.get('borsh')).toContain('bytes');
});

test('it generates PublicKey schema', () => {
    const result = visit(publicKeyTypeNode(), getBorshSchemaVisitor());
    expect(result.content).toBe('publicKey()');
    expect(result.imports.get('borsh')).toContain('publicKey');
});

test('it generates option schema', () => {
    const result = visit(optionTypeNode(numberTypeNode('u64')), getBorshSchemaVisitor());
    expect(result.content).toBe('option(u64())');
    expect(result.imports.get('borsh')).toContain('option');
    expect(result.imports.get('borsh')).toContain('u64');
});

test('it generates fixed-size array schema', () => {
    const result = visit(arrayTypeNode(numberTypeNode('u8'), fixedCountNode(32)), getBorshSchemaVisitor());
    expect(result.content).toBe('array(u8(), 32)');
    expect(result.imports.get('borsh')).toContain('array');
    expect(result.imports.get('borsh')).toContain('u8');
});

test('it generates variable-size array schema', () => {
    const result = visit(arrayTypeNode(stringTypeNode('utf8'), remainderCountNode()), getBorshSchemaVisitor());
    expect(result.content).toBe('array(str())');
    expect(result.imports.get('borsh')).toContain('array');
    expect(result.imports.get('borsh')).toContain('str');
});

test('it generates struct schema', () => {
    const result = visit(
        structTypeNode([
            structFieldTypeNode({ name: 'amount', type: numberTypeNode('u64') }),
            structFieldTypeNode({ name: 'owner', type: publicKeyTypeNode() }),
        ]),
        getBorshSchemaVisitor(),
    );
    expect(result.content).toBe("struct([['amount', u64()], ['owner', publicKey()]])");
    expect(result.imports.get('borsh')).toContain('struct');
    expect(result.imports.get('borsh')).toContain('u64');
    expect(result.imports.get('borsh')).toContain('publicKey');
});

test('it generates empty struct schema', () => {
    const result = visit(structTypeNode([]), getBorshSchemaVisitor());
    expect(result.content).toBe('struct([])');
    expect(result.imports.get('borsh')).toContain('struct');
});

test('it generates tuple schema', () => {
    const result = visit(tupleTypeNode([numberTypeNode('u32'), stringTypeNode('utf8')]), getBorshSchemaVisitor());
    expect(result.content).toBe('tuple([u32(), str()])');
    expect(result.imports.get('borsh')).toContain('tuple');
    expect(result.imports.get('borsh')).toContain('u32');
    expect(result.imports.get('borsh')).toContain('str');
});

test('it generates scalar enum schema as u8', () => {
    const result = visit(
        enumTypeNode([
            enumEmptyVariantTypeNode('up'),
            enumEmptyVariantTypeNode('down'),
            enumEmptyVariantTypeNode('left'),
            enumEmptyVariantTypeNode('right'),
        ]),
        getBorshSchemaVisitor(),
    );
    expect(result.content).toBe('u8()');
    expect(result.imports.get('borsh')).toContain('u8');
});

test('it generates data enum schema', () => {
    const result = visit(
        enumTypeNode([
            enumStructVariantTypeNode(
                'write',
                structTypeNode([structFieldTypeNode({ name: 'data', type: stringTypeNode('utf8') })]),
            ),
            enumTupleVariantTypeNode('read', tupleTypeNode([numberTypeNode('u32')])),
        ]),
        getBorshSchemaVisitor(),
    );
    expect(result.content).toContain('enm([');
    expect(result.content).toContain("['Write', struct([['data', str()]])]");
    expect(result.content).toContain("['Read', struct([['fields', tuple([u32()])]])]");
    expect(result.imports.get('borsh')).toContain('enm');
    expect(result.imports.get('borsh')).toContain('struct');
});

test('it generates schema for defined type link', () => {
    const result = visit(definedTypeLinkNode('myCustomType'), getBorshSchemaVisitor());
    expect(result.content).toBe('MyCustomTypeSchema');
    expect(result.imports.get('generatedTypes')).toContain('MyCustomTypeSchema');
});

test('it generates schema for nested structs', () => {
    const result = visit(
        structTypeNode([
            structFieldTypeNode({
                name: 'metadata',
                type: structTypeNode([
                    structFieldTypeNode({ name: 'name', type: stringTypeNode('utf8') }),
                    structFieldTypeNode({ name: 'version', type: numberTypeNode('u8') }),
                ]),
            }),
            structFieldTypeNode({ name: 'active', type: booleanTypeNode() }),
        ]),
        getBorshSchemaVisitor(),
    );
    expect(result.content).toBe(
        "struct([['metadata', struct([['name', str()], ['version', u8()]])], ['active', bool()]])",
    );
});

test('it generates schema for complex nested types', () => {
    const result = visit(
        structTypeNode([
            structFieldTypeNode({
                name: 'items',
                type: arrayTypeNode(
                    structTypeNode([
                        structFieldTypeNode({ name: 'id', type: numberTypeNode('u32') }),
                        structFieldTypeNode({ name: 'value', type: numberTypeNode('u64') }),
                    ]),
                    remainderCountNode(),
                ),
            }),
        ]),
        getBorshSchemaVisitor(),
    );
    expect(result.content).toContain("array(struct([['id', u32()], ['value', u64()]]))");
});
