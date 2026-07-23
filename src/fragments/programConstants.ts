import { camelCase, CamelCaseString, ConstantNode, isNode, ProgramNode, resolveNestedTypeNode, ValueNode } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import {
    addFragmentImports,
    Fragment,
    fragment,
    getCodeFileFragment,
    getJsDocFragment,
    getStringValueAsHexadecimals,
    mergeFragments,
} from '../utils';
import { getValueVisitor, ValueVisitor } from '../visitors/getValueVisitor';

export function getProgramConstantsFragment(
    node: ProgramNode,
    internalNodes: CamelCaseString[] = [],
): Fragment {
    const fragments: Fragment[] = [];

    // 1. Program ID constant
    fragments.push(getProgramIdFragment(node));

    // 2. Program constants from the IDL
    const constants = node.constants ?? [];
    if (constants.length > 0) {
        const valueVisitor = getValueVisitor();
        fragments.push(
            mergeFragments(
                constants.map(constant => getConstantFragment(constant, valueVisitor)),
                cs => cs.join('\n'),
            ),
        );
    }

    // 3. Export all from subdirectories
    fragments.push(getExportsFragment(node, internalNodes));

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments);
}

export function getProgramIdConstantName(programName: string): string {
    return `${programName.toUpperCase()}_PROGRAM_ID`;
}

export function getConstantExportName(name: string): string {
    return name.toUpperCase();
}

function getProgramIdFragment(node: ProgramNode): Fragment {
    const constantName = getProgramIdConstantName(node.name);

    return addFragmentImports(
        fragment`export const ${constantName} = new Address('${node.publicKey}');`,
        'web3',
        'Address',
    );
}

function getConstantFragment(constant: ConstantNode, valueVisitor: ValueVisitor): Fragment {
    const name = getConstantExportName(constant.name);
    const value = getConstantValueFragment(constant, valueVisitor);

    return mergeFragments([getJsDocFragment(constant.docs), fragment`export const ${name} = ${value};`], cs =>
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
    const exports: string[] = [];
    const isNotInternal = (name: CamelCaseString) => !internalNodes.includes(name);

    // Export all accounts
    if (node.accounts.length > 0) {
        node.accounts.filter(account => isNotInternal(account.name)).forEach(account => {
            exports.push(`export * from './accounts/${camelCase(account.name)}';`);
        });
    }

    // Export all instructions
    if (node.instructions.length > 0) {
        node.instructions.filter(instruction => isNotInternal(instruction.name)).forEach(instruction => {
            exports.push(`export * from './instructions/${camelCase(instruction.name)}';`);
        });
    }

    // Export all PDAs
    if (node.pdas.length > 0) {
        node.pdas.filter(pda => isNotInternal(pda.name)).forEach(pda => {
            exports.push(`export * from './pdas/${camelCase(pda.name)}';`);
        });
    }

    // Export all defined types
    if (node.definedTypes.length > 0) {
        node.definedTypes.filter(type => isNotInternal(type.name)).forEach(type => {
            exports.push(`export * from './types/${camelCase(type.name)}';`);
        });
    }

    return fragment`${exports.join('\n')}`;
}
