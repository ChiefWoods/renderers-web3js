import { DefinedTypeNode } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import { Fragment, fragment, getCodeFileFragment } from '../utils';
import { BorshSchemaVisitor, TypeVisitor } from '../visitors';

export function getDefinedTypeFragment(
    node: DefinedTypeNode,
    typeVisitor: TypeVisitor,
    borshSchemaVisitor: BorshSchemaVisitor,
): Fragment {
    const fragments: Fragment[] = [];

    // 1. Generate the type definition
    const typeDefinition = visit(node, typeVisitor);
    fragments.push(typeDefinition);

    // 2. Generate Borsh schema if it's a struct or enum
    if (node.type.kind === 'structTypeNode' || node.type.kind === 'enumTypeNode') {
        const schemaFragment = getTypeSchemaFragment(node, borshSchemaVisitor);
        if (schemaFragment) {
            fragments.push(schemaFragment);
        }
    }

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments);
}

function getTypeSchemaFragment(node: DefinedTypeNode, borshSchemaVisitor: BorshSchemaVisitor): Fragment | undefined {
    // Don't generate schemas for simple type aliases
    if (
        node.type.kind !== 'structTypeNode' &&
        node.type.kind !== 'enumTypeNode' &&
        node.type.kind !== 'tupleTypeNode'
    ) {
        return undefined;
    }

    const schema = visit(node.type, borshSchemaVisitor);
    return fragment`export const ${node.name}Schema = ${schema};`;
}
