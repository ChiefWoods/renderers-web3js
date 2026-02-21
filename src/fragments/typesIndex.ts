import { camelCase, ProgramNode } from '@codama/nodes';

import { Fragment, fragment } from '../utils';

export function getTypesIndexFragment(node: ProgramNode): Fragment {
    if (node.definedTypes.length === 0) {
        return fragment``;
    }

    const exports = node.definedTypes.map(type => {
        return fragment`export * from './${camelCase(type.name)}';`;
    });

    return fragment`${exports.map(f => f.content).join('\n')}`;
}
