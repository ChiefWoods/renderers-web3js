import { getAllInstructionsWithSubs, instructionNode, programNode, rootNode } from '@codama/nodes';
import { visit } from '@codama/visitors-core';
import { expect, test } from 'vitest';

import { getRenderMapVisitor } from '../../src/visitors/getRenderMapVisitor';

test('getAllInstructionsWithSubs returns leaves by default', () => {
    const program = programNode({
        instructions: [
            instructionNode({
                name: 'parent',
                subInstructions: [instructionNode({ name: 'child' })],
            }),
        ],
        name: 'test',
        publicKey: '11111111111111111111111111111111',
    });

    const leaves = getAllInstructionsWithSubs(program, { leavesOnly: true }).map(i => i.name);
    const all = getAllInstructionsWithSubs(program, { leavesOnly: false }).map(i => i.name);

    expect(leaves).toEqual(['child']);
    expect(all).toEqual(['parent', 'child']);
});

test('it renders only leaf instructions by default', () => {
    const program = programNode({
        instructions: [
            instructionNode({
                name: 'parent',
                subInstructions: [instructionNode({ name: 'child' })],
            }),
        ],
        name: 'test',
        publicKey: '11111111111111111111111111111111',
    });

    const renderMap = visit(rootNode(program), getRenderMapVisitor());
    const keys = [...renderMap.keys()];

    expect(keys).toContain('instructions/child.ts');
    expect(keys).not.toContain('instructions/parent.ts');
});

test('it renders parent instructions when renderParentInstructions is true', () => {
    const program = programNode({
        instructions: [
            instructionNode({
                name: 'parent',
                subInstructions: [instructionNode({ name: 'child' })],
            }),
        ],
        name: 'test',
        publicKey: '11111111111111111111111111111111',
    });

    const renderMap = visit(rootNode(program), getRenderMapVisitor({ renderParentInstructions: true }));
    const keys = [...renderMap.keys()];

    expect(keys).toContain('instructions/child.ts');
    expect(keys).toContain('instructions/parent.ts');
});
