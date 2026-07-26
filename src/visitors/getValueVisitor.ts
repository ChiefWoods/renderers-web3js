import { camelCase, CamelCaseString, pascalCase, REGISTERED_VALUE_NODE_KINDS } from '@codama/nodes';
import { extendVisitor, NodeStack, pipe, recordNodeStackVisitor, staticVisitor, visit } from '@codama/visitors-core';

import {
    addFragmentImports,
    fragment,
    GetImportFromFunction,
    getStringValueAsHexadecimals,
    mergeFragments,
} from '../utils';

export type ValueVisitor = ReturnType<typeof getValueVisitor>;

export function getValueVisitor(
    input: {
        getImportFrom?: GetImportFromFunction;
        nonScalarEnums?: CamelCaseString[];
        stack?: NodeStack;
    } = {},
) {
    const stack = input.stack ?? new NodeStack();
    const nonScalarEnums = input.nonScalarEnums ?? [];
    const getImportFrom =
        input.getImportFrom ??
        ((node: { kind: string }) => (node.kind === 'definedTypeLinkNode' ? 'generatedTypes' : 'generatedTypes'));

    return pipe(
        staticVisitor(() => fragment``, {
            keys: [...REGISTERED_VALUE_NODE_KINDS, 'programIdValueNode'],
        }),
        visitor =>
            extendVisitor(visitor, {
                visitArrayValue(node, { self }) {
                    return mergeFragments(
                        node.items.map(item => visit(item, self)),
                        cs => `[${cs.join(', ')}]`,
                    );
                },

                visitBooleanValue(node) {
                    return fragment`${node.boolean ? 'true' : 'false'}`;
                },

                visitBytesValue(node) {
                    return fragment`${getStringValueAsHexadecimals(node.encoding, node.data)}`;
                },

                visitConstantValue(node, { self }) {
                    return visit(node.value, self);
                },

                visitEnumValue(node, { self }) {
                    const enumName = pascalCase(node.enum.name);
                    const importFrom = getImportFrom(node.enum);
                    const isNonScalar = nonScalarEnums.includes(node.enum.name);

                    if (isNonScalar) {
                        const constructorName = camelCase(node.enum.name);
                        const variantName = pascalCase(node.variant);
                        if (!node.value) {
                            return addFragmentImports(
                                fragment`${constructorName}('${variantName}')`,
                                importFrom,
                                constructorName,
                            );
                        }
                        const value = visit(node.value, self);
                        return addFragmentImports(
                            fragment`${constructorName}('${variantName}', ${value})`,
                            importFrom,
                            constructorName,
                        );
                    }

                    const enumType = addFragmentImports(fragment`${enumName}`, importFrom, enumName);
                    return fragment`${enumType}.${pascalCase(node.variant)}`;
                },

                visitMapEntryValue(node, { self }) {
                    const key = visit(node.key, self);
                    const value = visit(node.value, self);
                    return fragment`[${key}, ${value}]`;
                },

                visitMapValue(node, { self }) {
                    return mergeFragments(
                        node.entries.map(entry => visit(entry, self)),
                        cs => `new Map([${cs.join(', ')}])`,
                    );
                },

                visitNoneValue() {
                    return fragment`null`;
                },

                visitNumberValue(node) {
                    return fragment`${node.number}`;
                },

                visitProgramIdValue() {
                    return fragment`programId`;
                },

                visitPublicKeyValue(node) {
                    return fragment`"${node.publicKey}"`;
                },

                visitSetValue(node, { self }) {
                    return mergeFragments(
                        node.items.map(item => visit(item, self)),
                        cs => `new Set([${cs.join(', ')}])`,
                    );
                },

                visitSomeValue(node, { self }) {
                    return visit(node.value, self);
                },

                visitStringValue(node) {
                    return fragment`"${node.string}"`;
                },

                visitStructFieldValue(node, { self }) {
                    return fragment`${node.name}: ${visit(node.value, self)}`;
                },

                visitStructValue(node, { self }) {
                    return mergeFragments(
                        node.fields.map(field => visit(field, self)),
                        cs => (cs.length > 0 ? `{ ${cs.join(', ')} }` : '{}'),
                    );
                },

                visitTupleValue(node, { self }) {
                    return mergeFragments(
                        node.items.map(item => visit(item, self)),
                        cs => `[${cs.join(', ')}]`,
                    );
                },
            }),
        visitor => recordNodeStackVisitor(visitor, stack),
    );
}
