import { camelCase, ProgramNode } from '@codama/nodes';

import { addFragmentImports, Fragment, fragment, getCodeFileFragment } from '../utils';

export function getProgramConstantsFragment(node: ProgramNode): Fragment {
    const fragments: Fragment[] = [];

    // 1. Program ID constant
    fragments.push(getProgramIdFragment(node));

    // 2. Export all from subdirectories
    fragments.push(getExportsFragment(node));

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments);
}

function getProgramIdFragment(node: ProgramNode): Fragment {
    const constantName = `${node.name.toUpperCase()}_PROGRAM_ID`;

    return addFragmentImports(
        fragment`export const ${constantName} = new PublicKey('${node.publicKey}');`,
        'web3',
        'PublicKey',
    );
}

function getExportsFragment(node: ProgramNode): Fragment {
    const exports: string[] = [];

    // Export all accounts
    if (node.accounts.length > 0) {
        node.accounts.forEach(account => {
            exports.push(`export * from './accounts/${camelCase(account.name)}';`);
        });
    }

    // Export all instructions
    if (node.instructions.length > 0) {
        node.instructions.forEach(instruction => {
            exports.push(`export * from './instructions/${camelCase(instruction.name)}';`);
        });
    }

    // Export all PDAs
    if (node.pdas.length > 0) {
        node.pdas.forEach(pda => {
            exports.push(`export * from './pdas/${camelCase(pda.name)}';`);
        });
    }

    // Export all defined types
    if (node.definedTypes.length > 0) {
        node.definedTypes.forEach(type => {
            exports.push(`export * from './types/${camelCase(type.name)}';`);
        });
    }

    return fragment`${exports.join('\n')}`;
}
