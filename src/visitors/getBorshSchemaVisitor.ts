import {
    camelCase,
    isNode,
    isScalarEnum,
    pascalCase,
    REGISTERED_TYPE_NODE_KINDS,
    resolveNestedTypeNode,
} from '@codama/nodes';
import { extendVisitor, NodeStack, pipe, recordNodeStackVisitor, staticVisitor, visit } from '@codama/visitors-core';

import { addFragmentImports, fragment, mergeFragments } from '../utils';

export type BorshSchemaVisitor = ReturnType<typeof getBorshSchemaVisitor>;

export function getBorshSchemaVisitor(input: { stack?: NodeStack } = {}) {
    const stack = input.stack ?? new NodeStack();

    return pipe(
        staticVisitor(() => fragment``, {
            keys: [...REGISTERED_TYPE_NODE_KINDS, 'definedTypeLinkNode', 'definedTypeNode'],
        }),
        visitor =>
            extendVisitor(visitor, {
                visitAmountType(node, { self }) {
                    // Ignore amount metadata, just use the underlying number type
                    return visit(node.number, self);
                },

                visitArrayType(node, { self }) {
                    const item = visit(node.item, self);

                    // Handle fixed size arrays
                    if (isNode(node.count, 'fixedCountNode')) {
                        return addFragmentImports(fragment`array(${item}, ${node.count.value})`, 'borsh', 'array');
                    }

                    // Variable size arrays (prefixed with u32 length)
                    return addFragmentImports(fragment`array(${item})`, 'borsh', 'array');
                },

                visitBooleanType() {
                    return addFragmentImports(fragment`bool()`, 'borsh', 'bool');
                },

                visitBytesType() {
                    // Bytes as a variable-length array
                    return addFragmentImports(fragment`array(u8())`, 'borsh', ['array', 'u8']);
                },

                visitDateTimeType(node, { self }) {
                    // DateTime is just a number underneath
                    return visit(node.number, self);
                },

                visitDefinedType(node, { self }) {
                    // For defined types, return the schema for the underlying type
                    return visit(node.type, self);
                },

                visitDefinedTypeLink(node) {
                    // Reference to another schema
                    const schemaName = `${pascalCase(node.name)}Schema`;
                    return addFragmentImports(fragment`${schemaName}`, 'generatedTypes', schemaName);
                },

                visitEnumType(node, { self }) {
                    if (isScalarEnum(node)) {
                        // Scalar enums are represented as u8 discriminator
                        return addFragmentImports(fragment`u8()`, 'borsh', 'u8');
                    }

                    // Data enums: array of variant schemas
                    const variants = node.variants.map(variant => {
                        const variantName = pascalCase(variant.name);
                        const variantSchema = visit(variant, self);
                        return fragment`['${variantName}', ${variantSchema}]`;
                    });

                    const variantsContent = mergeFragments(variants, cs => cs.join(', '));
                    return addFragmentImports(fragment`enm([${variantsContent}])`, 'borsh', 'enm');
                },

                visitEnumEmptyVariantType() {
                    // Empty variant: unit struct
                    return addFragmentImports(fragment`struct([])`, 'borsh', 'struct');
                },

                visitEnumStructVariantType(node, { self }) {
                    // Struct variant
                    const fields = resolveNestedTypeNode(node.struct).fields;
                    const fieldSchemas = fields.map(field => {
                        const fieldName = camelCase(field.name);
                        const fieldSchema = visit(field.type, self);
                        return fragment`['${fieldName}', ${fieldSchema}]`;
                    });

                    const fieldsContent = mergeFragments(fieldSchemas, cs => cs.join(', '));
                    return addFragmentImports(fragment`struct([${fieldsContent}])`, 'borsh', 'struct');
                },

                visitEnumTupleVariantType(node, { self }) {
                    // Tuple variant: convert to struct with 'fields' array
                    const tupleSchema = visit(node.tuple, self);
                    return addFragmentImports(fragment`struct([['fields', ${tupleSchema}]])`, 'borsh', 'struct');
                },

                visitFixedSizeType(node, { self }) {
                    // Ignore fixed size wrapper
                    return visit(node.type, self);
                },

                visitHiddenPrefixType(node, { self }) {
                    // Ignore hidden prefix wrapper
                    return visit(node.type, self);
                },

                visitHiddenSuffixType(node, { self }) {
                    // Ignore hidden suffix wrapper
                    return visit(node.type, self);
                },

                visitMapType(node, { self }) {
                    const key = visit(node.key, self);
                    const value = visit(node.value, self);
                    return addFragmentImports(fragment`map(${key}, ${value})`, 'borsh', 'map');
                },

                visitNumberType(node) {
                    const format = node.format;
                    const fnName = format;
                    return addFragmentImports(fragment`${fnName}()`, 'borsh', fnName);
                },

                visitOptionType(node, { self }) {
                    const item = visit(node.item, self);
                    return addFragmentImports(fragment`option(${item})`, 'borsh', 'option');
                },

                visitPostOffsetType(node, { self }) {
                    // Ignore post offset wrapper
                    return visit(node.type, self);
                },

                visitPreOffsetType(node, { self }) {
                    // Ignore pre offset wrapper
                    return visit(node.type, self);
                },

                visitPublicKeyType() {
                    // PublicKey is 32 bytes
                    return addFragmentImports(fragment`publicKey()`, 'borsh', 'publicKey');
                },

                visitRemainderOptionType(node, { self }) {
                    const item = visit(node.item, self);
                    return addFragmentImports(fragment`option(${item})`, 'borsh', 'option');
                },

                visitSentinelType(node, { self }) {
                    // Ignore sentinel wrapper
                    return visit(node.type, self);
                },

                visitSetType(node, { self }) {
                    // Set as array
                    const item = visit(node.item, self);
                    return addFragmentImports(fragment`array(${item})`, 'borsh', 'array');
                },

                visitSizePrefixType(node, { self }) {
                    // Ignore size prefix wrapper
                    return visit(node.type, self);
                },

                visitSolAmountType(node, { self }) {
                    // Sol amount is just a number
                    return visit(node.number, self);
                },

                visitStringType() {
                    // UTF-8 string
                    return addFragmentImports(fragment`str()`, 'borsh', 'str');
                },

                visitStructType(node, { self }) {
                    if (node.fields.length === 0) {
                        return addFragmentImports(fragment`struct([])`, 'borsh', 'struct');
                    }

                    const fieldSchemas = node.fields.map(field => {
                        const fieldName = camelCase(field.name);
                        const fieldSchema = visit(field.type, self);
                        return fragment`['${fieldName}', ${fieldSchema}]`;
                    });

                    const fieldsContent = mergeFragments(fieldSchemas, cs => cs.join(', '));
                    return addFragmentImports(fragment`struct([${fieldsContent}])`, 'borsh', 'struct');
                },

                visitTupleType(node, { self }) {
                    const itemSchemas = node.items.map(item => visit(item, self));
                    const itemsContent = mergeFragments(itemSchemas, cs => cs.join(', '));
                    return addFragmentImports(fragment`tuple([${itemsContent}])`, 'borsh', 'tuple');
                },

                visitZeroableOptionType(node, { self }) {
                    const item = visit(node.item, self);
                    return addFragmentImports(fragment`option(${item})`, 'borsh', 'option');
                },
            }),
        visitor => recordNodeStackVisitor(visitor, stack),
    );
}
