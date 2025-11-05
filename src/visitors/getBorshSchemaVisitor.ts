import { camelCase, isNode, isScalarEnum, REGISTERED_TYPE_NODE_KINDS, resolveNestedTypeNode } from '@codama/nodes';
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
                    const schemaName = `${camelCase(node.name)}Schema`;
                    console.log(`🔗 [DefinedTypeLink] Importing schema: ${schemaName} from 'generatedTypes'`);
                    return addFragmentImports(fragment`${schemaName}`, 'generatedTypes', schemaName);
                },

                visitEnumType(node) {
                    if (isScalarEnum(node)) {
                        // Scalar enums are represented as u8 discriminator
                        return addFragmentImports(fragment`u8()`, 'borsh', 'u8');
                    }

                    // Data enums (tagged unions) are not directly supported by @coral-xyz/borsh
                    // They would need to be manually implemented with custom serialization
                    throw new Error(
                        `Complex enum types are not supported by @coral-xyz/borsh. ` +
                            `Enum with variants needs custom implementation.`,
                    );
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
                        return fragment`${fieldSchema}("${fieldName}")`;
                    });

                    const fieldsContent = mergeFragments(fieldSchemas, cs => cs.join(', '));
                    return addFragmentImports(fragment`struct([${fieldsContent}])`, 'borsh', 'struct');
                },

                visitEnumTupleVariantType(node, { self }) {
                    // Tuple variant: convert to struct with 'fields' array
                    const tupleSchema = visit(node.tuple, self);
                    return addFragmentImports(fragment`struct([${tupleSchema}("fields")])`, 'borsh', 'struct');
                },

                visitFixedSizeType(node, { self }) {
                    // Handle fixed size bytes as fixed-size arrays
                    if (isNode(node.type, 'bytesTypeNode')) {
                        return addFragmentImports(fragment`array(u8(), ${node.size})`, 'borsh', ['array', 'u8']);
                    }
                    // For other types, ignore fixed size wrapper
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

                visitMapType() {
                    // Map types are not supported by @coral-xyz/borsh
                    throw new Error('Map types are not supported by @coral-xyz/borsh');
                },

                visitNumberType(node) {
                    const format = node.format;
                    const fnName = format;
                    return addFragmentImports(fragment`${fnName}()`, 'borsh', fnName);
                },

                visitOptionType(node, { self }) {
                    const item = visit(node.item, self);

                    // Use standard borsh option (u8-prefixed)
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
                    console.log(`🔧 [RemainderOption] called`);
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
                    console.log(`   🔧 [BorshSchema] Generating struct with ${node.fields.length} fields`);

                    if (node.fields.length === 0) {
                        return addFragmentImports(fragment`struct([])`, 'borsh', 'struct');
                    }

                    const fieldSchemas = node.fields.map(field => {
                        const fieldName = camelCase(field.name);
                        console.log(`🔧 [Field] ${fieldName} - type: ${field.type.kind}`);
                        const fieldSchema = visit(field.type, self);
                        console.log(`      - Field: ${fieldName} → ${fieldSchema.content}`);

                        const schemaContent = fieldSchema.content;

                        // Add field name as parameter
                        // For most layouts: u8() -> u8("fieldName")
                        // For option/array: option(publicKey()) -> option(publicKey(), "fieldName")
                        let newContent: string;
                        if (schemaContent.endsWith('()')) {
                            // Simple layout like u8() - add field name inside parens
                            newContent = schemaContent.replace('()', `("${fieldName}")`);
                        } else {
                            // Nested layout like option(publicKey()) or array(u8(), 10)
                            // Add field name as the last parameter before closing paren
                            newContent = schemaContent.replace(/\)$/, `, "${fieldName}")`);
                        }

                        // Create new fragment with modified content but preserve ALL imports
                        const resultFragment: typeof fieldSchema = {
                            content: newContent,
                            imports: fieldSchema.imports,
                        };

                        return resultFragment;
                    });

                    const fieldsContent = mergeFragments(fieldSchemas, cs => cs.join(', '));
                    return addFragmentImports(fragment`struct([${fieldsContent}])`, 'borsh', 'struct');
                },

                visitTupleType(node, { self }) {
                    // Tuples are not directly supported by @coral-xyz/borsh
                    // They can be represented as structs with indexed field names
                    const fieldSchemas = node.items.map((item, index) => {
                        const fieldSchema = visit(item, self);
                        return fragment`${fieldSchema}("field${index}")`;
                    });
                    const fieldsContent = mergeFragments(fieldSchemas, cs => cs.join(', '));
                    return addFragmentImports(fragment`struct([${fieldsContent}])`, 'borsh', 'struct');
                },

                visitZeroableOptionType(node, { self }) {
                    const item = visit(node.item, self);
                    return addFragmentImports(fragment`option(${item})`, 'borsh', 'option');
                },
            }),
        visitor => recordNodeStackVisitor(visitor, stack),
    );
}
