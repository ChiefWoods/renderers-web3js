import { camelCase, CamelCaseString, ProgramNode } from '@codama/nodes';

import { Fragment, fragment } from '../utils';

export function getTypesIndexFragment(node: ProgramNode, internalNodes: CamelCaseString[] = []): Fragment {
    const definedTypes = node.definedTypes.filter(type => !internalNodes.includes(type.name));
    if (definedTypes.length === 0) {
        return fragment``;
    }

    const exports = definedTypes.map(type => {
        return fragment`export * from './${camelCase(type.name)}';`;
    });

    return fragment`${exports.map(f => f.content).join('\n')}`;
}
