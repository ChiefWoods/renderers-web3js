import {
    CamelCaseString,
    ConstantNode,
    isNode,
    ProgramNode,
    resolveNestedTypeNode,
    snakeCase,
    ValueNode,
} from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import {
    addFragmentImports,
    DEFAULT_NAME_TRANSFORMERS,
    Fragment,
    fragment,
    getCodeFileFragment,
    getJsDocFragment,
    getNameApi,
    getStringValueAsHexadecimals,
    mergeFragments,
    NameApi,
    PathOverrides,
} from '../utils';
import { TypeManifestVisitor } from '../visitors/getTypeManifestVisitor';
import { getValueVisitor, ValueVisitor } from '../visitors/getValueVisitor';

export function getProgramConstantsFragment(
    node: ProgramNode,
    internalNodes: CamelCaseString[] = [],
    dependencyMap: PathOverrides = {},
): Fragment {
    return getCodeFileFragment([getExportsFragment(node, internalNodes)], dependencyMap);
}

export function getConstantsFragment(
    node: ProgramNode,
    typeManifestVisitor: TypeManifestVisitor,
    dependencyMap: PathOverrides = {},
    nonScalarEnums: CamelCaseString[] = [],
): Fragment {
    const constants = node.constants ?? [];
    const valueVisitor = getValueVisitor({ nonScalarEnums });
    return getCodeFileFragment(
        [
            mergeFragments(
                [...constants]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(constant => getConstantFragment(constant, valueVisitor, typeManifestVisitor)),
                cs => cs.join('\n'),
            ),
        ],
        dependencyMap,
    );
}

export function getProgramIdConstantName(
    programName: string,
    nameApi: NameApi = getNameApi(DEFAULT_NAME_TRANSFORMERS),
): string {
    return nameApi.programAddressConstant(programName);
}

export function getConstantExportName(name: string): string {
    if (/^[a-z][A-Z]+$/.test(name) || /^[A-Z0-9_]+$/.test(name)) {
        return name.toUpperCase();
    }
    return snakeCase(name).toUpperCase();
}

function getConstantFragment(
    constant: ConstantNode,
    valueVisitor: ValueVisitor,
    typeManifestVisitor: TypeManifestVisitor,
): Fragment {
    const name = getConstantExportName(constant.name);
    const value = getConstantValueFragment(constant, valueVisitor);
    const typeManifest = visit(constant.type, typeManifestVisitor);
    const isNumberValue = isNode(constant.value, 'numberValueNode');
    const isNumberType = isNode(constant.type, 'numberTypeNode');
    const isSafeNumberType = isNumberType && ['u8', 'u16', 'u32'].includes(constant.type.format);
    const useBigInt = isNumberValue && isNumberType && !isSafeNumberType;
    const type = isNode(constant.value, 'stringValueNode')
        ? fragment`string`
        : useBigInt
          ? fragment`bigint`
          : typeManifest.strictType;

    return mergeFragments([getJsDocFragment(constant.docs), fragment`export const ${name}: ${type} = ${value};`], cs =>
        cs.join('\n'),
    );
}

function getConstantValueFragment(constant: ConstantNode, valueVisitor: ValueVisitor): Fragment {
    const type = resolveNestedTypeNode(constant.type);

    if (isNode(type, 'publicKeyTypeNode')) {
        return addFragmentImports(fragment`new Address(${visit(constant.value, valueVisitor)})`, 'web3', 'Address');
    }

    if (isNode(type, 'bytesTypeNode') && constant.value.kind === 'bytesValueNode') {
        const hex = getStringValueAsHexadecimals(constant.value.encoding, constant.value.data).slice(2);
        return addFragmentImports(fragment`Buffer.from('${hex}', 'hex')`, 'buffer', 'Buffer');
    }

    if (
        isNode(type, 'numberTypeNode') &&
        constant.value.kind === 'numberValueNode' &&
        ['u64', 'u128', 'i64', 'i128'].includes(type.format)
    ) {
        return fragment`${constant.value.number}n`;
    }

    if (constant.value.kind === 'stringValueNode') {
        return fragment`${JSON.stringify(normalizeStringConstantValue(constant.value.string))}`;
    }

    return visit(constant.value as ValueNode, valueVisitor);
}

function normalizeStringConstantValue(value: string): string {
    try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed === 'string') {
            return parsed;
        }
    } catch {
        // Fall through to the raw value.
    }

    return value;
}

function getExportsFragment(node: ProgramNode, internalNodes: CamelCaseString[] = []): Fragment {
    const hasPublicNodes = (nodes: { name: CamelCaseString }[]) =>
        nodes.some(node => !internalNodes.includes(node.name));
    const exports: string[] = [];

    if (hasPublicNodes(node.accounts)) exports.push(`export * from './accounts';`);
    if ((node.constants ?? []).length > 0) exports.push(`export * from './constants';`);
    if ((node.errors ?? []).length > 0) exports.push(`export * from './errors';`);
    if (hasPublicNodes(node.events ?? [])) exports.push(`export * from './events';`);
    if (hasPublicNodes(node.instructions)) exports.push(`export * from './instructions';`);
    if (hasPublicNodes(node.pdas)) exports.push(`export * from './pdas';`);
    exports.push(`export * from './programs';`);
    if (hasPublicNodes(node.definedTypes)) exports.push(`export * from './types';`);

    return fragment`${exports.join('\n')}`;
}
