import { camelCase } from '@codama/nodes';
import { createRenderMap, mergeRenderMaps } from '@codama/renderers-core';
import {
    extendVisitor,
    LinkableDictionary,
    NodeStack,
    pipe,
    recordLinkablesOnFirstVisitVisitor,
    recordNodeStackVisitor,
    staticVisitor,
    visit,
} from '@codama/visitors-core';

import {
    getAccountTypeFragment,
    getDefinedTypeFragment,
    getInstructionFunctionFragment,
    getPdaFunctionFragment,
    getProgramConstantsFragment,
} from '../fragments';
import { RenderMapOptions } from '../utils';
import { getBorshSchemaVisitor } from './getBorshSchemaVisitor';
import { getTypeVisitor } from './getTypeVisitor-v2';

export function getRenderMapVisitor(options: RenderMapOptions = {}) {
    const linkables = new LinkableDictionary();
    const stack = new NodeStack();

    const extension = options.extension ?? 'ts';
    const indexFilename = options.indexFilename ?? 'index';
    const typeVisitor = getTypeVisitor({ stack, typeIndent: options.typeIndent });
    const borshSchemaVisitor = getBorshSchemaVisitor({ stack });

    return pipe(
        staticVisitor(() => createRenderMap(), {
            keys: ['rootNode', 'programNode', 'pdaNode', 'accountNode', 'definedTypeNode', 'instructionNode'],
        }),
        v =>
            extendVisitor(v, {
                visitAccount(node) {
                    return createRenderMap(
                        `accounts/${camelCase(node.name)}.${extension}`,
                        getAccountTypeFragment(node, typeVisitor, borshSchemaVisitor),
                    );
                },

                visitDefinedType(node) {
                    return createRenderMap(
                        `types/${camelCase(node.name)}.${extension}`,
                        getDefinedTypeFragment(node, typeVisitor, borshSchemaVisitor),
                    );
                },

                visitInstruction(node) {
                    return createRenderMap(
                        `instructions/${camelCase(node.name)}.${extension}`,
                        getInstructionFunctionFragment(node, typeVisitor, borshSchemaVisitor),
                    );
                },

                visitPda(node) {
                    return createRenderMap(
                        `pdas/${camelCase(node.name)}.${extension}`,
                        getPdaFunctionFragment(node, typeVisitor),
                    );
                },

                visitProgram(node, { self }) {
                    return mergeRenderMaps([
                        createRenderMap(`${indexFilename}.${extension}`, getProgramConstantsFragment(node)),
                        ...node.accounts.map(n => visit(n, self)),
                        ...node.definedTypes.map(n => visit(n, self)),
                        ...node.instructions.map(n => visit(n, self)),
                        ...node.pdas.map(n => visit(n, self)),
                    ]);
                },

                visitRoot(node, { self }) {
                    // Here, we ignore `node.additionalPrograms` for simplicity.
                    return visit(node.program, self);
                },
            }),
        v => recordNodeStackVisitor(v, stack),
        v => recordLinkablesOnFirstVisitVisitor(v, linkables),
    );
}
