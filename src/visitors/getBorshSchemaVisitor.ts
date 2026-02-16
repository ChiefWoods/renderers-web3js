import { camelCase, isNode, isScalarEnum, REGISTERED_TYPE_NODE_KINDS, resolveNestedTypeNode } from '@codama/nodes';
import { extendVisitor, NodeStack, pipe, recordNodeStackVisitor, staticVisitor, visit } from '@codama/visitors-core';

import { addFragmentImports, fragment, mergeFragments } from '../utils';

export type BorshSchemaVisitor = ReturnType<typeof getBorshSchemaVisitor>;

function isDefaultU32LePrefix(prefix: unknown): boolean {
    const resolved = resolveNestedTypeNode(prefix as Parameters<typeof resolveNestedTypeNode>[0]);
    return resolved.kind === 'numberTypeNode' && resolved.format === 'u32' && resolved.endian === 'le';
}

function getNumberCodec(format: string, endian: 'le' | 'be') {
    const fn = `get${format[0].toUpperCase()}${format.slice(1)}Codec`;
    if (endian === 'be') {
        return addFragmentImports(
            fragment`${fn}({ endian: Endian.Big })`,
            'codecs',
            [fn, 'Endian'],
        );
    }
    return addFragmentImports(fragment`${fn}()`, 'codecs', fn);
}

export function getBorshSchemaVisitor(input: { stack?: NodeStack } = {}) {
    const stack = input.stack ?? new NodeStack();

    return pipe(
        staticVisitor(() => fragment``, {
            keys: [...REGISTERED_TYPE_NODE_KINDS, 'definedTypeLinkNode', 'definedTypeNode'],
        }),
        visitor =>
            extendVisitor(visitor, {
                visitAmountType(node, { self }) {
                    return visit(node.number, self);
                },

                visitArrayType(node, { self }) {
                    const item = visit(node.item, self);

                    if (isNode(node.count, 'fixedCountNode')) {
                        return addFragmentImports(
                            fragment`getArrayCodec(${item}, { size: ${node.count.value} })`,
                            'codecs',
                            'getArrayCodec',
                        );
                    }

                    if (isNode(node.count, 'remainderCountNode')) {
                        return addFragmentImports(
                            fragment`getArrayCodec(${item}, { size: 'remainder' })`,
                            'codecs',
                            'getArrayCodec',
                        );
                    }

                    if (!isDefaultU32LePrefix(node.count.prefix)) {
                        const size = visit(node.count.prefix, self);
                        return addFragmentImports(
                            fragment`getArrayCodec(${item}, { size: ${size} })`,
                            'codecs',
                            'getArrayCodec',
                        );
                    }

                    return addFragmentImports(fragment`getArrayCodec(${item})`, 'codecs', 'getArrayCodec');
                },

                visitBooleanType() {
                    return addFragmentImports(fragment`getBooleanCodec()`, 'codecs', 'getBooleanCodec');
                },

                visitBytesType() {
                    return addFragmentImports(fragment`getBytesCodec()`, 'codecs', 'getBytesCodec');
                },

                visitDateTimeType(node, { self }) {
                    return visit(node.number, self);
                },

                visitDefinedType(node, { self }) {
                    return visit(node.type, self);
                },

                visitDefinedTypeLink(node) {
                    const codecName = `${camelCase(node.name)}Codec`;
                    return addFragmentImports(
                        fragment`${codecName}`,
                        `generatedTypes/${camelCase(node.name)}`,
                        codecName,
                    );
                },

                visitEnumType(node, { self }) {
                    if (isScalarEnum(node)) {
                        return addFragmentImports(fragment`getU8Codec()`, 'codecs', 'getU8Codec');
                    }

                    const variants = node.variants.map(variant => visit(variant, self));
                    const variantsFragment = mergeFragments(variants, cs => cs.join(', '));
                    return addFragmentImports(
                        fragment`getDiscriminatedUnionCodec([${variantsFragment}])`,
                        'codecs',
                        'getDiscriminatedUnionCodec',
                    );
                },

                visitEnumEmptyVariantType(node) {
                    return addFragmentImports(
                        fragment`['${camelCase(node.name).replace(/^./, c => c.toUpperCase())}', getUnitCodec()]`,
                        'codecs',
                        'getUnitCodec',
                    );
                },

                visitEnumStructVariantType(node, { self }) {
                    const fields = resolveNestedTypeNode(node.struct).fields;
                    const fieldSchemas = fields.map(field => {
                        const fieldName = camelCase(field.name);
                        const fieldSchema = visit(field.type, self);
                        return fragment`['${fieldName}', ${fieldSchema}]`;
                    });

                    const variantName = camelCase(node.name).replace(/^./, c => c.toUpperCase());
                    const fieldsContent = mergeFragments(fieldSchemas, cs => cs.join(', '));
                    return addFragmentImports(
                        fragment`['${variantName}', getStructCodec([${fieldsContent}])]`,
                        'codecs',
                        'getStructCodec',
                    );
                },

                visitEnumTupleVariantType(node, { self }) {
                    const tupleSchema = visit(node.tuple, self);
                    const variantName = camelCase(node.name).replace(/^./, c => c.toUpperCase());
                    return addFragmentImports(
                        fragment`['${variantName}', getStructCodec([['fields', ${tupleSchema}]])]`,
                        'codecs',
                        'getStructCodec',
                    );
                },

                visitFixedSizeType(node, { self }) {
                    const codec = visit(node.type, self);
                    return addFragmentImports(fragment`fixCodecSize(${codec}, ${node.size})`, 'codecs', 'fixCodecSize');
                },

                visitHiddenPrefixType(node, { self }) {
                    return visit(node.type, self);
                },

                visitHiddenSuffixType(node, { self }) {
                    return visit(node.type, self);
                },

                visitMapType(node, { self }) {
                    const key = visit(node.key, self);
                    const value = visit(node.value, self);

                    if (isNode(node.count, 'fixedCountNode')) {
                        return addFragmentImports(
                            fragment`getMapCodec(${key}, ${value}, { size: ${node.count.value} })`,
                            'codecs',
                            'getMapCodec',
                        );
                    }

                    if (isNode(node.count, 'remainderCountNode')) {
                        return addFragmentImports(
                            fragment`getMapCodec(${key}, ${value}, { size: 'remainder' })`,
                            'codecs',
                            'getMapCodec',
                        );
                    }

                    if (!isDefaultU32LePrefix(node.count.prefix)) {
                        const size = visit(node.count.prefix, self);
                        return addFragmentImports(
                            fragment`getMapCodec(${key}, ${value}, { size: ${size} })`,
                            'codecs',
                            'getMapCodec',
                        );
                    }

                    return addFragmentImports(fragment`getMapCodec(${key}, ${value})`, 'codecs', 'getMapCodec');
                },

                visitNumberType(node) {
                    return getNumberCodec(node.format, node.endian);
                },

                visitOptionType(node, { self }) {
                    const item = visit(node.item, self);
                    return addFragmentImports(fragment`getOptionCodec(${item})`, 'codecs', 'getOptionCodec');
                },

                visitPostOffsetType(node, { self }) {
                    return visit(node.type, self);
                },

                visitPreOffsetType(node, { self }) {
                    return visit(node.type, self);
                },

                visitPublicKeyType() {
                    let codec = addFragmentImports(
                        fragment`transformCodec(fixCodecSize(getBytesCodec(), 32), (value: PublicKey) => value.toBytes(), (value) => new PublicKey(value))`,
                        'codecs',
                        ['transformCodec', 'fixCodecSize', 'getBytesCodec'],
                    );
                    codec = addFragmentImports(codec, 'web3', 'PublicKey');
                    return codec;
                },

                visitRemainderOptionType(node, { self }) {
                    const item = visit(node.item, self);
                    return addFragmentImports(
                        fragment`getOptionCodec(${item}, { prefix: null })`,
                        'codecs',
                        'getOptionCodec',
                    );
                },

                visitSentinelType(node, { self }) {
                    return visit(node.type, self);
                },

                visitSetType(node, { self }) {
                    const item = visit(node.item, self);

                    if (isNode(node.count, 'fixedCountNode')) {
                        return addFragmentImports(
                            fragment`getSetCodec(${item}, { size: ${node.count.value} })`,
                            'codecs',
                            'getSetCodec',
                        );
                    }

                    if (isNode(node.count, 'remainderCountNode')) {
                        return addFragmentImports(
                            fragment`getSetCodec(${item}, { size: 'remainder' })`,
                            'codecs',
                            'getSetCodec',
                        );
                    }

                    if (!isDefaultU32LePrefix(node.count.prefix)) {
                        const size = visit(node.count.prefix, self);
                        return addFragmentImports(
                            fragment`getSetCodec(${item}, { size: ${size} })`,
                            'codecs',
                            'getSetCodec',
                        );
                    }

                    return addFragmentImports(fragment`getSetCodec(${item})`, 'codecs', 'getSetCodec');
                },

                visitSizePrefixType(node, { self }) {
                    const item = visit(node.type, self);
                    const prefix = visit(node.prefix, self);
                    return addFragmentImports(
                        fragment`addCodecSizePrefix(${item}, ${prefix})`,
                        'codecs',
                        'addCodecSizePrefix',
                    );
                },

                visitSolAmountType(node, { self }) {
                    return visit(node.number, self);
                },

                visitStringType(node) {
                    switch (node.encoding) {
                        case 'base16':
                            return addFragmentImports(fragment`getBase16Codec()`, 'codecs', 'getBase16Codec');
                        case 'base58':
                            return addFragmentImports(fragment`getBase58Codec()`, 'codecs', 'getBase58Codec');
                        case 'base64':
                            return addFragmentImports(fragment`getBase64Codec()`, 'codecs', 'getBase64Codec');
                        case 'utf8':
                        default:
                            return addFragmentImports(fragment`getUtf8Codec()`, 'codecs', 'getUtf8Codec');
                    }
                },

                visitStructType(node, { self }) {
                    if (node.fields.length === 0) {
                        return addFragmentImports(fragment`getStructCodec([])`, 'codecs', 'getStructCodec');
                    }

                    const fieldSchemas = node.fields.map(field => {
                        const fieldName = camelCase(field.name);
                        const fieldSchema = visit(field.type, self);
                        return fragment`['${fieldName}', ${fieldSchema}]`;
                    });

                    const fieldsContent = mergeFragments(fieldSchemas, cs => cs.join(', '));
                    return addFragmentImports(fragment`getStructCodec([${fieldsContent}])`, 'codecs', 'getStructCodec');
                },

                visitTupleType(node, { self }) {
                    const itemCodecs = node.items.map(item => visit(item, self));
                    const fieldsContent = mergeFragments(itemCodecs, cs => cs.join(', '));
                    return addFragmentImports(fragment`getTupleCodec([${fieldsContent}])`, 'codecs', 'getTupleCodec');
                },

                visitZeroableOptionType(node, { self }) {
                    const item = visit(node.item, self);
                    return addFragmentImports(
                        fragment`getOptionCodec(${item}, { prefix: null, noneValue: 'zeroes' })`,
                        'codecs',
                        'getOptionCodec',
                    );
                },
            }),
        visitor => recordNodeStackVisitor(visitor, stack),
    );
}
